import { useState, useEffect, useRef, useMemo } from 'react';
import { Performance } from './components/Performance';
import { TradeFeed } from './components/TradeFeed';
import { SourceDelays } from './components/SourceDelays';
import { MarketConfig } from './components/MarketConfig';
import { OrderFeed } from './components/OrderFeed';
import { PriceChart } from './components/PriceChart';
import { UpcomingGames } from './components/UpcomingGames';
import { TradeSize } from './components/TradeSize';
import { mockSourceDelays } from './mocks/data';
import type { TradeEntry, LogEntry, DayData, PerformanceStats, PhoneClient, KalshiTrade, PricePoint, PhoneActiveMarket } from './types';
import './App.css';

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
// Uses tradePnl on sells (set by server). Falls back to FIFO matching for
// older entries that pre-date server-side P&L tracking.

function computePnlHistory(trades: TradeEntry[]): PnlHistory {
  const history: PnlHistory = {};

  // FIFO matching for sells without tradePnl
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

// ---- Price-history cache (only used locally — server re-sends on connect) ----

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

// ---- Shared WebSocket hook ----

function useBotData() {
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [phones, setPhones] = useState<PhoneClient[]>([]);
  // Trades and ownFeed come from the server on connect — no localStorage seed
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [orderFeed, setOrderFeed] = useState<KalshiTrade[]>([]);
  const [priceHistoryData, setPriceHistoryData] = useState<PriceHistData | null>(loadPriceHistCache);
  // defaultTradeSize is now seeded by the server via dashboard_state
  const [serverDefaultSize, setServerDefaultSize] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const phonesRef = useRef<PhoneClient[]>([]);

  connectRef.current = () => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
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
          phonesRef.current = msg.data ?? [];
          setPhones(msg.data ?? []);

        } else if (msg.type === 'dashboard_state') {
          // Server sends full history on connect — replace local state entirely.
          const { trades: serverTrades, ownFeed, defaultTradeSize } = msg.data;
          setTrades(serverTrades ?? []);
          setOrderFeed(ownFeed ?? []);
          setServerDefaultSize(defaultTradeSize ?? null);

        } else if (msg.type === 'trade_update' && msg.data.status === 'filled') {
          // Live update — server already persisted this trade; just add to local state.
          const d = msg.data;
          const market = phonesRef.current.find(p => p.activeMarket)?.activeMarket;
          const trade: TradeEntry = {
            id: `${d.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
            action: d.action,
            team: d.team,
            contracts: d.size ?? 0,
            price: d.price ?? 0,
            fee: d.fee,
            latencyMs: d.latencyMs,
            marketDesc: market?.description,
            homeTitle: market?.homeTitle,
            awayTitle: market?.awayTitle,
            platform: 'kalshi',
            timestamp: d.timestamp ?? Date.now(),
            sim: d.sim ?? false,
            tradePnl: d.tradePnl,
          };
          setTrades(prev => [trade, ...prev].slice(0, 500));

        } else if (msg.type === 'pnl') {
          setPnl(msg.data as PnlData);

        } else if (msg.type === 'price_history') {
          const histData: PriceHistData = {
            homeTicker: msg.data.homeTicker,
            awayTicker: msg.data.awayTicker,
            homePoints: msg.data.homePoints,
            awayPoints: msg.data.awayPoints,
          };
          setPriceHistoryData(histData);
          savePriceHistCache(histData);

        } else if (msg.type === 'default_size_update') {
          setServerDefaultSize(msg.data.size ?? null);

        } else if (msg.type === 'log') {
          setLogs(prev => [msg.data, ...prev].slice(0, 1000));

        } else if (msg.type === 'kalshi_order_feed') {
          setOrderFeed(prev => {
            const idx = prev.findIndex(t => t.tradeId === msg.data.tradeId);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = msg.data;
              return next;
            }
            const withNew = [msg.data, ...prev];
            if (withNew.length <= 300) return withNew;
            // Trim to 300 but never evict own entries
            const result = [...withNew];
            let excess = result.length - 300;
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

// ---- App ----

function App() {
  const { wsStatus, wsRef, phones, trades, logs, orderFeed, priceHistoryData, serverDefaultSize } = useBotData();

  // Trade size lives here (not inside TradeSize) so it survives tab switches.
  const [tradeSize, setTradeSize] = useState<number>(50);
  // Sync from server whenever dashboard_state arrives.
  useEffect(() => {
    if (serverDefaultSize != null) setTradeSize(serverDefaultSize);
  }, [serverDefaultSize]);
  const applyTradeSize = (s: number) => {
    setTradeSize(s);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set_default_size', data: { size: s } }));
    }
  };

  const [activeMarket, setActiveMarket] = useState<PhoneActiveMarket | null>(null);
  useEffect(() => {
    const m = phones.find(p => p.activeMarket)?.activeMarket ?? null;
    if (m) setActiveMarket(m);
  }, [phones]);

  // Compute daily P&L history from the server-authoritative trade list
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

  const homeTicker = activeMarket?.homeKalshiTicker ?? '';
  const awayTicker = activeMarket?.awayKalshiTicker ?? homeTicker;
  const matchedHistory = (
    priceHistoryData?.homeTicker === homeTicker &&
    priceHistoryData?.awayTicker === awayTicker
  ) ? priceHistoryData : null;

  const [activeTab, setActiveTab] = useState<'home' | 'live'>('live');

  return (
    <div className="app-shell">
      <div className="app-tabs">
        <button
          className={`app-tab${activeTab === 'home' ? ' app-tab-active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          Home
        </button>
        <button
          className={`app-tab${activeTab === 'live' ? ' app-tab-active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          Live
        </button>
      </div>

      {activeTab === 'home' && (
        <div className="app">
          <div className="left-column">
            <Performance stats={stats} calendarData={calendarData} />
            <UpcomingGames />
          </div>
          <div className="right-column">
            <SourceDelays delays={mockSourceDelays} />
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="app">
          <div className="left-column">
            <PriceChart
              homeTicker={homeTicker}
              awayTicker={awayTicker}
              homeTitle={activeMarket?.homeTitle}
              awayTitle={activeMarket?.awayTitle}
              homeHistory={matchedHistory?.homePoints ?? []}
              awayHistory={matchedHistory?.awayPoints ?? []}
              orderFeed={orderFeed}
            />
            <TradeFeed trades={trades} logs={logs} />
          </div>
          <div className="right-column">
            <TradeSize size={tradeSize} onApply={applyTradeSize} />
            <MarketConfig wsRef={wsRef} wsStatus={wsStatus} phones={phones} />
            <OrderFeed trades={orderFeed} market={activeMarket} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
