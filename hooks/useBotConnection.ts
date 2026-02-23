import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../types';

// ---------- Bot message types (mirrors bot-backend/src/types.ts) ----------

interface TradeUpdateData {
  action: 'buy' | 'sell';
  team: 'home' | 'away';
  status: 'pending' | 'filled' | 'partial' | 'failed';
  price?: number;
  size?: number;
  latencyMs?: number;
  error?: string;
}

interface StatusData {
  connected: boolean;
  testMode: boolean;
  market: unknown;
}

interface ActiveMarketData {
  homeKalshiTicker?: string;
  awayKalshiTicker?: string;
  homeTitle?: string;
  awayTitle?: string;
  description?: string;
}

interface PnlData {
  realizedPnl: number;
  unrealizedPnl: number;
  openPositions: number;
  tradeCount: number;
}

type BotMessage =
  | { type: 'status'; data: StatusData }
  | { type: 'trade_update'; data: TradeUpdateData }
  | { type: 'market_configured'; data: ActiveMarketData }
  | { type: 'pnl'; data: PnlData }
  | { type: 'set_label'; data: { label: string } }
  | { type: 'error'; data: { message: string } }
  | { type: 'default_size_update'; data: { size: number } };

// ---------- Hook options ----------

interface MarketTokenConfig {
  // Original Polymarket CLOB
  conditionId?: string;
  homeTokenId?: string;
  awayTokenId?: string;
  // Polymarket US
  homeMarketSlug?: string;
  awayMarketSlug?: string;
  awayIsShort?: boolean;
  // Kalshi
  homeKalshiTicker?: string;
  awayKalshiTicker?: string;
  description?: string;
}

interface UseBotConnectionOptions {
  /** ws:// or wss:// URL of the bot backend. */
  url: string;
  /** Team labels used to build human-readable log messages. */
  homeLabel: string;
  awayLabel: string;
  /** Called whenever a new log entry arrives from the bot. */
  onLogEntry: (entry: LogEntry) => void;
  /** Real market token config. If omitted, sends test tokens. */
  marketConfig?: MarketTokenConfig;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

const MARKET_STORAGE_KEY = 'pm_active_market';
const LABEL_STORAGE_KEY = 'pm_device_label';

function detectDeviceLabel(): string {
  try {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) {
      const m = ua.match(/iPhone OS (\d+)_(\d+)/);
      return m ? `iPhone iOS ${m[1]}.${m[2]}` : 'iPhone';
    }
    if (/iPad/.test(ua)) {
      const m = ua.match(/CPU OS (\d+)_(\d+)/);
      return m ? `iPad iOS ${m[1]}.${m[2]}` : 'iPad';
    }
    if (/Android/.test(ua)) {
      const m = ua.match(/Android [\d.]+; ([^;)]+)/);
      return m ? m[1].trim() : 'Android';
    }
  } catch {}
  return 'Phone';
}

export function useBotConnection({
  url,
  homeLabel,
  awayLabel,
  onLogEntry,
  marketConfig,
}: UseBotConnectionOptions) {
  // Persist the device label across reconnects. Dashboard can rename it via set_label.
  const deviceLabelRef = useRef<string>(
    (() => { try { return localStorage.getItem(LABEL_STORAGE_KEY) || detectDeviceLabel(); } catch { return detectDeviceLabel(); } })()
  );

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [testMode, setTestMode] = useState(false);
  const [defaultTradeSize, setDefaultTradeSize] = useState<number>(50);
  const [activeMarket, setActiveMarket] = useState<ActiveMarketData | null>(() => {
    try {
      const stored = localStorage.getItem(MARKET_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as ActiveMarketData) : null;
    } catch {
      return null;
    }
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep callback ref fresh without triggering effect re-runs
  const onLogEntryRef = useRef(onLogEntry);
  onLogEntryRef.current = onLogEntry;
  const homeLabelRef = useRef(homeLabel);
  homeLabelRef.current = homeLabel;
  const awayLabelRef = useRef(awayLabel);
  awayLabelRef.current = awayLabel;
  // Keep the current URL in a ref so the reconnect closure always uses the latest
  const urlRef = useRef(url);
  urlRef.current = url;

  // ---- helpers ----

  const ts = () =>
    new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const pushLog = useCallback(
    (message: string, type: LogEntry['type']) => {
      onLogEntryRef.current({
        id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
        timestamp: ts(),
        message,
        type,
      });
    },
    [],
  );

  const teamLabel = useCallback(
    (team: 'home' | 'away') =>
      team === 'home' ? homeLabelRef.current : awayLabelRef.current,
    [],
  );

  // ---- handle incoming messages ----

  const handleBotMessage = useCallback(
    (msg: BotMessage) => {
      switch (msg.type) {
        case 'status':
          setTestMode(msg.data.testMode);
          pushLog(
            msg.data.testMode
              ? 'Bot connected (TEST MODE)'
              : 'Bot connected',
            'info',
          );
          break;

        case 'market_configured':
          try { localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(msg.data)); } catch {}
          setActiveMarket(msg.data);
          pushLog('Market configured', 'info');
          break;

        case 'set_label':
          deviceLabelRef.current = msg.data.label;
          try { localStorage.setItem(LABEL_STORAGE_KEY, msg.data.label); } catch {}
          break;

        case 'trade_update': {
          const d = msg.data;
          const label = teamLabel(d.team);
          if (d.status === 'pending') {
            pushLog(`${d.action === 'buy' ? 'Buying' : 'Selling'} ${label}...`, 'info');
          } else if (d.status === 'filled') {
            const price = d.price != null ? (d.price * 100).toFixed(0) + '¢' : '?';
            const size = d.size ?? '?';
            const feeStr = d.fee != null ? ` fee $${d.fee.toFixed(2)}` : '';
            const latency = d.latencyMs ? ` (${d.latencyMs}ms)` : '';
            pushLog(
              d.action === 'buy'
                ? `Bought ${size} @ ${price}${feeStr}${latency}`
                : `Sold ${size} @ ${price}${feeStr}${latency}`,
              d.action === 'buy' ? 'trade' : 'sell',
            );
          } else if (d.status === 'failed') {
            pushLog(`${d.action} failed: ${d.error ?? 'unknown'}`, 'info');
          }
          break;
        }

        case 'pnl': {
          const p = msg.data;
          const fees = p.totalFees > 0 ? ` | fees $${p.totalFees.toFixed(2)}` : '';
          pushLog(
            `P&L: realized ${p.realizedPnl >= 0 ? '+' : ''}$${p.realizedPnl.toFixed(2)}${fees} | ${p.openPositions} open`,
            'info',
          );
          break;
        }

        case 'default_size_update':
          setDefaultTradeSize(msg.data.size);
          break;

        case 'error':
          pushLog(`Bot error: ${msg.data.message}`, 'info');
          break;
      }
    },
    [pushLog, teamLabel],
  );

  // ---- connect / disconnect with auto-reconnect ----

  // Use a stable connect function that reads the URL from the ref.
  // This prevents stale closures in onclose from reconnecting to old URLs.
  const connectRef = useRef<() => void>(() => {});

  connectRef.current = () => {
    // Clean up any existing connection first
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent old onclose from firing
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const currentUrl = urlRef.current;
    setStatus('connecting');
    pushLog(`Connecting to ${currentUrl}...`, 'info');

    const ws = new WebSocket(currentUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) { ws.close(); return; }
      setStatus('connected');

      // Identify this connection as a phone so the dashboard can see it.
      ws.send(JSON.stringify({ type: 'register', data: { clientType: 'phone', label: deviceLabelRef.current } }));

      // Re-announce the last known market so the dashboard card always shows
      // the correct market — even after a bot restart (which clears server memory).
      // Prefer the dashboard-assigned market saved in localStorage; fall back to
      // the hardcoded marketConfig if nothing is stored yet.
      try {
        const stored = localStorage.getItem(MARKET_STORAGE_KEY);
        if (stored) {
          const market = JSON.parse(stored);
          if (market.homeKalshiTicker || market.awayKalshiTicker ||
              market.homeMarketSlug   || market.awayMarketSlug   ||
              market.homeTokenId      || market.awayTokenId) {
            ws.send(JSON.stringify({ type: 'configure_market', data: market }));
          }
        } else {
          // Nothing stored yet — use the hardcoded config if present.
          const config = marketConfig;
          const hasMarket = config && (
            config.homeKalshiTicker || config.awayKalshiTicker ||
            config.homeMarketSlug   || config.awayMarketSlug   ||
            config.homeTokenId      || config.awayTokenId
          );
          if (hasMarket) {
            ws.send(JSON.stringify({ type: 'configure_market', data: config }));
          }
        }
      } catch {
        // localStorage unavailable — skip
      }
    };

    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === 'string'
          ? event.data
          : String(event.data);
        const msg: BotMessage = JSON.parse(raw);
        handleBotMessage(msg);
      } catch (e) {
        console.warn('[useBotConnection] Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      // Only handle if this is still the active socket
      if (wsRef.current !== ws) return;
      setStatus('disconnected');
      pushLog('Disconnected — retrying in 3s...', 'info');
      reconnectTimer.current = setTimeout(() => connectRef.current(), 3000);
    };

    ws.onerror = () => {
      // onclose will fire after this, which handles reconnect
    };
  };

  // Connect on mount + reconnect whenever URL changes
  useEffect(() => {
    connectRef.current();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url]);

  // ---- public API ----

  /** Send a buy signal. `team` should be 'home' or 'away'. */
  const sendSignal = useCallback(
    (team: 'home' | 'away') => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = JSON.stringify({ type: 'signal', data: { team } });
        ws.send(payload);
        pushLog('Sent to bot', 'info');
      } else {
        pushLog('Not connected to bot — signal not sent', 'info');
      }
    },
    [pushLog],
  );

  /** Send a sell signal. */
  const sendSell = useCallback(
    (team: 'home' | 'away', size: number) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'sell', data: { team, size } }));
        pushLog('Sell sent to bot', 'info');
      } else {
        pushLog('Not connected to bot — sell not sent', 'info');
      }
    },
    [pushLog],
  );

  /** Request P&L summary from the bot. */
  const requestPnl = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'pnl' }));
    }
  }, []);

  /** Toggle test mode on the bot at runtime. */
  const sendSetTestMode = useCallback((enabled: boolean) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set_test_mode', data: { enabled } }));
    }
  }, []);

  /** Set the default trade size on the bot (syncs to all connected clients). */
  const sendSetDefaultSize = useCallback((size: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'set_default_size', data: { size } }));
    }
  }, []);

  return { status, testMode, activeMarket, defaultTradeSize, sendSignal, sendSell, requestPnl, sendSetTestMode, sendSetDefaultSize };
}
