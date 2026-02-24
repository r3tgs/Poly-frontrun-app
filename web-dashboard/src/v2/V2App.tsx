import { useState, useEffect, useRef, useMemo } from 'react';
import { V2Navbar } from './V2Navbar';
import { V2EquityCurve } from './V2EquityCurve';
import { V2RollingPerformance } from './V2RollingPerformance';
import { V2Performance } from './V2Performance';
import { V2SourceDelays } from './V2SourceDelays';
import { V2TradeFeed } from './V2TradeFeed';
import { V2UpcomingGames } from './V2UpcomingGames';
import { mockSourceDelays } from '../mocks/data';
import type { TradeEntry, LogEntry, PerformanceStats, PhoneClient, PricePoint, PhoneActiveMarket, KalshiTrade, DayData } from '../types';
import './v2.css';

const BOT_WS_URL = 'wss://pm-frontrun-snowy-waterfall-1028.fly.dev';

// ---- Types ----

interface PnlData {
  totalSpent: number;
  totalReceived: number;
  totalFees: number;
  realizedPnl: number;
  unrealizedPnl: number;
  openPositions: number;
  tradeCount: number;
}

type PnlHistory = Record<string, { realized: number; spent: number; tradeCount: number }>;
type PriceHistData = { homeTicker: string; awayTicker: string; homePoints: PricePoint[]; awayPoints: PricePoint[] };

// ---- pnlHistory computed from trade list ----

function computePnlHistory(trades: TradeEntry[]): PnlHistory {
  const history: PnlHistory = {};
  const positions = new Map<string, { totalCost: number; contracts: number; avgPrice: number }>();
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  for (const trade of sorted) {
    const d = new Date(trade.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!history[key]) history[key] = { realized: 0, spent: 0, tradeCount: 0 };
    history[key].tradeCount++;

    const posKey = `${trade.team}::${trade.homeTitle ?? ''}::${trade.awayTitle ?? ''}`;

    if (trade.action === 'buy') {
      const cost = trade.contracts * trade.price + (trade.fee ?? 0);
      history[key].spent += cost;
      const ex = positions.get(posKey);
      if (ex) {
        const n = ex.contracts + trade.contracts;
        ex.avgPrice = (ex.totalCost + cost) / n;
        ex.totalCost += cost;
        ex.contracts = n;
      } else {
        positions.set(posKey, { totalCost: cost, contracts: trade.contracts, avgPrice: cost / trade.contracts });
      }
    } else if (trade.action === 'sell') {
      let pnl = trade.tradePnl;
      if (pnl == null) {
        const pos = positions.get(posKey);
        if (pos && pos.contracts > 0) {
          const net = trade.contracts * trade.price - (trade.fee ?? 0);
          pnl = net - trade.contracts * pos.avgPrice;
          pos.contracts -= trade.contracts;
          pos.totalCost = pos.contracts > 0 ? pos.contracts * pos.avgPrice : 0;
          if (pos.contracts <= 0) positions.delete(posKey);
        }
      }
      if (pnl != null) history[key].realized += pnl;
    }
  }
  return history;
}

// ---- Calendar builder ----

function buildCalendarData(history: PnlHistory): DayData[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: DayData[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, pnl: 0, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, pnl: history[key]?.realized ?? 0, isCurrentMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0 || cells.length < 35) {
    cells.push({ day: next++, pnl: 0, isCurrentMonth: false });
  }
  return cells;
}

// ---- Price-history cache ----

const PRICE_HIST_KEY = 'pm_price_history_cache';

function loadPriceHistCache(): PriceHistData | null {
  try {
    const raw = localStorage.getItem(PRICE_HIST_KEY);
    return raw ? (JSON.parse(raw) as PriceHistData) : null;
  } catch { return null; }
}

function savePriceHistCache(data: PriceHistData): void {
  try { localStorage.setItem(PRICE_HIST_KEY, JSON.stringify(data)); } catch {}
}

// ---- WebSocket hook (same logic as v1) ----

function useBotData() {
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [phones, setPhones] = useState<PhoneClient[]>([]);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [orderFeed, setOrderFeed] = useState<KalshiTrade[]>([]);
  const [priceHistoryData, setPriceHistoryData] = useState<PriceHistData | null>(loadPriceHistCache);
  const [serverDefaultSize, setServerDefaultSize] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const phonesRef = useRef<PhoneClient[]>([]);

  connectRef.current = () => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    if (wsRef.current) {
      wsRef.current.onopen = null; wsRef.current.onclose = null;
      wsRef.current.onmessage = null; wsRef.current.onerror = null;
      wsRef.current.close(); wsRef.current = null;
    }
    setWsStatus('connecting');
    const ws = new WebSocket(BOT_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) { ws.close(); return; }
      setWsStatus('connected');
      ws.send(JSON.stringify({ type: 'register', data: { clientType: 'dashboard' } }));
      ws.send(JSON.stringify({ type: 'pnl' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
        if (msg.type === 'clients_update') {
          phonesRef.current = msg.data ?? []; setPhones(msg.data ?? []);
        } else if (msg.type === 'dashboard_state') {
          const { trades: st, ownFeed, defaultTradeSize } = msg.data;
          setTrades(st ?? []); setOrderFeed(ownFeed ?? []);
          setServerDefaultSize(defaultTradeSize ?? null);
        } else if (msg.type === 'trade_update' && msg.data.status === 'filled') {
          const d = msg.data;
          const market = phonesRef.current.find(p => p.activeMarket)?.activeMarket;
          const trade: TradeEntry = {
            id: `${d.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
            action: d.action, team: d.team, contracts: d.size ?? 0, price: d.price ?? 0,
            fee: d.fee, latencyMs: d.latencyMs, marketDesc: market?.description,
            homeTitle: market?.homeTitle, awayTitle: market?.awayTitle,
            platform: 'kalshi', timestamp: d.timestamp ?? Date.now(),
            sim: d.sim ?? false, tradePnl: d.tradePnl,
          };
          setTrades(prev => [trade, ...prev].slice(0, 500));
        } else if (msg.type === 'pnl') {
          setPnl(msg.data as PnlData);
        } else if (msg.type === 'price_history') {
          const histData: PriceHistData = {
            homeTicker: msg.data.homeTicker, awayTicker: msg.data.awayTicker,
            homePoints: msg.data.homePoints, awayPoints: msg.data.awayPoints,
          };
          setPriceHistoryData(histData); savePriceHistCache(histData);
        } else if (msg.type === 'default_size_update') {
          setServerDefaultSize(msg.data.size ?? null);
        } else if (msg.type === 'log') {
          setLogs(prev => [msg.data, ...prev].slice(0, 1000));
        } else if (msg.type === 'kalshi_order_feed') {
          setOrderFeed(prev => {
            const idx = prev.findIndex(t => t.tradeId === msg.data.tradeId);
            if (idx !== -1) { const next = [...prev]; next[idx] = msg.data; return next; }
            const withNew = [msg.data, ...prev];
            if (withNew.length <= 300) return withNew;
            const result = [...withNew]; let excess = result.length - 300;
            for (let i = result.length - 1; i >= 0 && excess > 0; i--) {
              if (!result[i].isOwn) { result.splice(i, 1); excess--; }
            }
            return result;
          });
        }
      } catch {}
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(() => connectRef.current(), 4000);
    };
    ws.onerror = () => {};
  };

  useEffect(() => {
    connectRef.current();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, []);

  return { wsStatus, wsRef, phones, trades, pnl, logs, orderFeed, priceHistoryData, serverDefaultSize };
}

// ---- V2 App ----

export default function V2App() {
  const { wsStatus, phones, trades, logs } = useBotData();

  const [activeTab, setActiveTab] = useState<'home' | 'live'>('home');

  const pnlHistory = useMemo(() => computePnlHistory(trades), [trades]);

  const allDays = Object.values(pnlHistory);
  const totalProfit = allDays.reduce((s, d) => s + d.realized, 0);
  const totalSpent = allDays.reduce((s, d) => s + d.spent, 0);
  const totalTrades = allDays.reduce((s, d) => s + d.tradeCount, 0);

  const stats: PerformanceStats = {
    totalProfit,
    roi: totalSpent > 0 ? (totalProfit / totalSpent) * 100 : 0,
    totalBets: totalTrades,
  };

  const calendarData = buildCalendarData(pnlHistory);

  return (
    <div className="v2-root">
      <div className="v2-shell">
        <V2Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          wsStatus={wsStatus}
          phones={phones}
        />

        {activeTab === 'home' && (
          <div className="v2-page">
            <div className="v2-col-left">
              <V2EquityCurve
                pnlHistory={pnlHistory}
                stats={{ totalProfit, roi: stats.roi, totalTrades }}
              />
              <V2UpcomingGames />
            </div>

            <div className="v2-col-center">
              <V2RollingPerformance pnlHistory={pnlHistory} />
              <V2Performance stats={stats} calendarData={calendarData} />
              <V2SourceDelays delays={mockSourceDelays} />
            </div>

            <div className="v2-col-right">
              <V2TradeFeed trades={trades} logs={logs} />
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="v2-page">
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--TEXT_SECONDARY)', fontSize: 16, fontWeight: 500, padding: 80 }}>
              Live tab — coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
