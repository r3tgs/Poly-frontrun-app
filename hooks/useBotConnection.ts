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

interface PnlData {
  realizedPnl: number;
  unrealizedPnl: number;
  openPositions: number;
  tradeCount: number;
}

type BotMessage =
  | { type: 'status'; data: StatusData }
  | { type: 'trade_update'; data: TradeUpdateData }
  | { type: 'market_configured'; data: unknown }
  | { type: 'pnl'; data: PnlData }
  | { type: 'error'; data: { message: string } };

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

export function useBotConnection({
  url,
  homeLabel,
  awayLabel,
  onLogEntry,
  marketConfig,
}: UseBotConnectionOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [testMode, setTestMode] = useState(false);
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
          pushLog('Market configured', 'info');
          break;

        case 'trade_update': {
          const d = msg.data;
          const label = teamLabel(d.team);
          if (d.status === 'pending') {
            pushLog(`${d.action === 'buy' ? 'Buying' : 'Selling'} ${label}...`, 'info');
          } else if (d.status === 'filled') {
            const price = d.price?.toFixed(2) ?? '?';
            const size = d.size ?? '?';
            const latency = d.latencyMs ? ` (${d.latencyMs}ms)` : '';
            pushLog(
              d.action === 'buy'
                ? `Bought ${size} contracts @ ${price}${latency}`
                : `Sold ${size} contracts @ ${price}${latency}`,
              d.action === 'buy' ? 'trade' : 'sell',
            );
          } else if (d.status === 'failed') {
            pushLog(`${d.action} failed: ${d.error ?? 'unknown'}`, 'info');
          }
          break;
        }

        case 'pnl': {
          const p = msg.data;
          pushLog(
            `P&L: realized ${p.realizedPnl >= 0 ? '+' : ''}${p.realizedPnl.toFixed(2)} USDC | ${p.openPositions} open`,
            'info',
          );
          break;
        }

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
      ws.send(JSON.stringify({ type: 'register', data: { clientType: 'phone' } }));

      // Configure market so signals work immediately.
      const config = marketConfig ?? {
        conditionId: 'test-condition',
        homeTokenId: 'test-home-token',
        awayTokenId: 'test-away-token',
        description: `${homeLabelRef.current} vs ${awayLabelRef.current}`,
      };
      ws.send(
        JSON.stringify({
          type: 'configure_market',
          data: config,
        }),
      );
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

  return { status, testMode, sendSignal, sendSell, requestPnl };
}
