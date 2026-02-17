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

interface UseBotConnectionOptions {
  /** ws:// or wss:// URL of the bot backend. */
  url: string;
  /** Team labels used to build human-readable log messages. */
  homeLabel: string;
  awayLabel: string;
  /** Called whenever a new log entry arrives from the bot. */
  onLogEntry: (entry: LogEntry) => void;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export function useBotConnection({
  url,
  homeLabel,
  awayLabel,
  onLogEntry,
}: UseBotConnectionOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [testMode, setTestMode] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onLogEntryRef = useRef(onLogEntry);
  onLogEntryRef.current = onLogEntry;

  const teamLabel = useCallback(
    (team: 'home' | 'away') => (team === 'home' ? homeLabel : awayLabel),
    [homeLabel, awayLabel],
  );

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

  // ---- connect / disconnect ----

  useEffect(() => {
    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');

      // Auto-configure a test market so signals work immediately.
      ws.send(
        JSON.stringify({
          type: 'configure_market',
          data: {
            conditionId: 'test-condition',
            homeTokenId: 'test-home-token',
            awayTokenId: 'test-away-token',
            description: `${homeLabel} vs ${awayLabel}`,
          },
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg: BotMessage = JSON.parse(
          typeof event.data === 'string' ? event.data : '',
        );
        handleBotMessage(msg);
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [url, homeLabel, awayLabel, handleBotMessage]);

  // ---- public API ----

  /** Send a buy signal. `team` should be 'home' or 'away'. */
  const sendSignal = useCallback((team: 'home' | 'away') => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'signal', data: { team } }));
    }
  }, []);

  /** Send a sell signal. */
  const sendSell = useCallback((team: 'home' | 'away', size: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'sell', data: { team, size } }));
    }
  }, []);

  /** Request P&L summary from the bot. */
  const requestPnl = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'pnl' }));
    }
  }, []);

  return { status, testMode, sendSignal, sendSell, requestPnl };
}
