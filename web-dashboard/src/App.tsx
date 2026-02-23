import { useState, useEffect, useRef } from 'react';
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

// ---- Daily PnL persistence ----

const PNL_HISTORY_KEY = 'pnl_daily_history';
const PNL_BASELINE_KEY = 'pnl_session_baseline';

/** Per-day accumulated totals (may span multiple bot sessions). */
type PnlHistory = Record<string, { realized: number; spent: number; tradeCount: number }>;

/**
 * Records how much PnL was already stored for today before the current bot
 * session started. Used to detect bot restarts and accumulate correctly.
 */
interface PnlBaseline {
  date: string;
  histRealized: number;
  histSpent: number;
  histTradeCount: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadPnlHistory(): PnlHistory {
  try { return JSON.parse(localStorage.getItem(PNL_HISTORY_KEY) ?? '{}'); } catch { return {}; }
}

function savePnlHistory(h: PnlHistory): void {
  try { localStorage.setItem(PNL_HISTORY_KEY, JSON.stringify(h)); } catch {}
}

function loadPnlBaseline(): PnlBaseline | null {
  try {
    const raw = localStorage.getItem(PNL_BASELINE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePnlBaseline(b: PnlBaseline): void {
  try { localStorage.setItem(PNL_BASELINE_KEY, JSON.stringify(b)); } catch {}
}

// ---- Calendar builder ----

/** Build a 5-row Monday-first calendar for the current month using stored daily PnL. */
function buildCalendarData(history: PnlHistory): DayData[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = (firstDow + 6) % 7; // Mon-first
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

// ---- Trade persistence ----

const TRADES_STORAGE_KEY = 'pm_trade_history';
const MAX_STORED_TRADES = 500;

function loadStoredTrades(): TradeEntry[] {
  try {
    const raw = localStorage.getItem(TRADES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TradeEntry[]) : [];
  } catch {
    return [];
  }
}

function persistTrades(trades: TradeEntry[]): void {
  try {
    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(trades));
  } catch {}
}

// ---- Own order-feed persistence (chart dots survive refresh + market end) ----

const OWN_FEED_KEY = 'pm_own_order_feed';

function loadOwnOrderFeed(): KalshiTrade[] {
  try {
    const raw = localStorage.getItem(OWN_FEED_KEY);
    return raw ? (JSON.parse(raw) as KalshiTrade[]) : [];
  } catch { return []; }
}

function persistOwnOrderFeed(trades: KalshiTrade[]): void {
  try { localStorage.setItem(OWN_FEED_KEY, JSON.stringify(trades)); } catch {}
}

// ---- Price-history cache (chart lines survive refresh + market end) ----

const PRICE_HIST_KEY = 'pm_price_history_cache';

type PriceHistData = { homeTicker: string; awayTicker: string; homePoints: PricePoint[]; awayPoints: PricePoint[] };

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
  const [trades, setTrades] = useState<TradeEntry[]>(loadStoredTrades);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [orderFeed, setOrderFeed] = useState<KalshiTrade[]>(loadOwnOrderFeed);
  const [priceHistoryData, setPriceHistoryData] = useState<PriceHistData | null>(loadPriceHistCache);

  // PnL history persisted to localStorage
  const pnlHistoryRef = useRef<PnlHistory>(loadPnlHistory());
  const pnlBaselineRef = useRef<PnlBaseline | null>(loadPnlBaseline());
  const lastBackendTradeCountRef = useRef<number>(0);
  const [pnlHistory, setPnlHistory] = useState<PnlHistory>(pnlHistoryRef.current);

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

        } else if (msg.type === 'trade_update' && msg.data.status === 'filled') {
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

          setTrades(prev => {
            const next = [trade, ...prev].slice(0, MAX_STORED_TRADES);
            persistTrades(next);
            return next;
          });

        } else if (msg.type === 'pnl') {
          const data = msg.data as PnlData;
          const today = todayKey();
          let baseline = pnlBaselineRef.current;
          const lastCount = lastBackendTradeCountRef.current;

          // Detect bot restart: tradeCount went backwards (new session started at 0)
          const botRestarted = data.tradeCount < lastCount;
          // Detect new day: baseline was set for a different date
          const newDay = !baseline || today !== baseline.date;

          if (!baseline || botRestarted || newDay) {
            // Snapshot whatever is already stored for today as the baseline.
            // New session's PnL will accumulate on top of this.
            baseline = {
              date: today,
              histRealized: pnlHistoryRef.current[today]?.realized ?? 0,
              histSpent: pnlHistoryRef.current[today]?.spent ?? 0,
              histTradeCount: pnlHistoryRef.current[today]?.tradeCount ?? 0,
            };
            pnlBaselineRef.current = baseline;
            savePnlBaseline(baseline);
          }

          lastBackendTradeCountRef.current = data.tradeCount;

          // Today's cumulative = what prior sessions contributed + this session's values
          const todayEntry = {
            realized: baseline.histRealized + data.realizedPnl,
            spent: baseline.histSpent + data.totalSpent,
            tradeCount: baseline.histTradeCount + data.tradeCount,
          };

          const newHistory = { ...pnlHistoryRef.current, [today]: todayEntry };
          pnlHistoryRef.current = newHistory;
          savePnlHistory(newHistory);
          setPnlHistory(newHistory);
          setPnl(data);

        } else if (msg.type === 'price_history') {
          const histData: PriceHistData = {
            homeTicker: msg.data.homeTicker,
            awayTicker: msg.data.awayTicker,
            homePoints: msg.data.homePoints,
            awayPoints: msg.data.awayPoints,
          };
          setPriceHistoryData(histData);
          savePriceHistCache(histData);

        } else if (msg.type === 'log') {
          setLogs(prev => [msg.data, ...prev].slice(0, 1000));

        } else if (msg.type === 'kalshi_order_feed') {
          setOrderFeed(prev => {
            const idx = prev.findIndex(t => t.tradeId === msg.data.tradeId);
            let next: KalshiTrade[];
            if (idx !== -1) {
              next = [...prev];
              next[idx] = msg.data;
            } else {
              const withNew = [msg.data, ...prev];
              if (withNew.length <= 300) {
                next = withNew;
              } else {
                // Trim to 300 but never evict own-trade entries (they power the chart dots).
                const result = [...withNew];
                let excess = result.length - 300;
                for (let i = result.length - 1; i >= 0 && excess > 0; i--) {
                  if (!result[i].isOwn) { result.splice(i, 1); excess--; }
                }
                next = result;
              }
            }
            // Persist own entries so chart dots survive page refresh and market end.
            const ownEntries = next.filter(t => t.isOwn);
            persistOwnOrderFeed(ownEntries);
            return next;
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

  return { wsStatus, wsRef, phones, trades, pnl, pnlHistory, logs, orderFeed, priceHistoryData };
}

// ---- App ----

function App() {
  const { wsStatus, wsRef, phones, trades, pnlHistory, logs, orderFeed, priceHistoryData } = useBotData();

  // Persist the last-known active market so the chart and order feed keep running
  // if the phone briefly disconnects. Only updates when a market is actually found.
  const [activeMarket, setActiveMarket] = useState<PhoneActiveMarket | null>(null);
  useEffect(() => {
    const m = phones.find(p => p.activeMarket)?.activeMarket ?? null;
    if (m) setActiveMarket(m);
  }, [phones]);

  // Aggregate stats across all stored days
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
  // Only pass history if it matches the current market
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
            <TradeSize wsRef={wsRef} wsStatus={wsStatus} />
            <MarketConfig wsRef={wsRef} wsStatus={wsStatus} phones={phones} />
            <OrderFeed trades={orderFeed} market={activeMarket} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
