import { useState, useEffect, useRef } from 'react';
import { Performance } from './components/Performance';
import { TradeFeed } from './components/TradeFeed';
import { SourceDelays } from './components/SourceDelays';
import { MarketConfig } from './components/MarketConfig';
import { mockSourceDelays } from './mocks/data';
import type { TradeEntry, LogEntry, DayData, PerformanceStats, PhoneClient } from './types';
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

// ---- Calendar builder ----

/** Build a 5-row Monday-first calendar for the current month.
 *  Today's cell gets the current session's realized P&L; all other days = 0. */
function buildCalendarData(todayPnl: number): DayData[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  // 0=Sun … 6=Sat → convert to Mon-first (0=Mon … 6=Sun)
  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = (firstDow + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: DayData[] = [];

  // Trailing days from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, pnl: 0, isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, pnl: d === today ? todayPnl : 0, isCurrentMonth: true });
  }

  // Leading days from next month — pad to complete rows of 7
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

// ---- Shared WebSocket hook ----

function useBotData() {
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [phones, setPhones] = useState<PhoneClient[]>([]);
  const [trades, setTrades] = useState<TradeEntry[]>(loadStoredTrades);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});
  // Keep phones accessible inside the WS message handler without stale closure
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
      // Request initial P&L snapshot
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
          // Resolve market context from whichever phone has an active market
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
          };

          setTrades(prev => {
            const next = [trade, ...prev].slice(0, MAX_STORED_TRADES);
            persistTrades(next);
            return next;
          });

          // Refresh P&L after every fill
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pnl' }));
          }

        } else if (msg.type === 'pnl') {
          setPnl(msg.data);

        } else if (msg.type === 'log') {
          setLogs(prev => [msg.data, ...prev].slice(0, 1000));
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

    // Poll P&L every 10 s so the dashboard stays current even when idle
    const pnlPoll = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'pnl' }));
      }
    }, 10_000);

    return () => {
      clearInterval(pnlPoll);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, []);

  return { wsStatus, wsRef, phones, trades, pnl, logs };
}

// ---- App ----

function App() {
  const { wsStatus, wsRef, phones, trades, pnl, logs } = useBotData();

  const stats: PerformanceStats = {
    totalProfit: pnl?.realizedPnl ?? 0,
    roi: pnl && pnl.totalSpent > 0
      ? (pnl.realizedPnl / pnl.totalSpent) * 100
      : 0,
    totalBets: pnl?.tradeCount ?? 0,
  };

  const calendarData = buildCalendarData(pnl?.realizedPnl ?? 0);

  return (
    <div className="app">
      <div className="left-column">
        <Performance stats={stats} calendarData={calendarData} />
        <TradeFeed trades={trades} logs={logs} />
      </div>
      <div className="right-column">
        <SourceDelays delays={mockSourceDelays} />
        <MarketConfig wsRef={wsRef} wsStatus={wsStatus} phones={phones} />
      </div>
    </div>
  );
}

export default App;
