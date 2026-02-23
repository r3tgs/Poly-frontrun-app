import { useState, useRef, useEffect, useMemo } from 'react';
import type { TradeEntry, LogEntry } from '../types';
import buyIcon from '../assets/PM Buy Icon.svg';
import sellIcon from '../assets/PM Sell Icon.svg';
import kalshiLogo from '../assets/PM Kalshi.svg';
import polyLogo from '../assets/PM Poly.svg';
import './TradeFeed.css';

type FeedFilter = 'all' | 'today' | '24h' | '1h';

const FILTERS: { label: string; value: FeedFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: '24h', value: '24h' },
  { label: '1h', value: '1h' },
];

function applyFilter(trades: TradeEntry[], filter: FeedFilter): TradeEntry[] {
  if (filter === 'all') return trades;
  const now = Date.now();
  if (filter === '1h') return trades.filter(t => now - t.timestamp <= 60 * 60 * 1000);
  if (filter === '24h') return trades.filter(t => now - t.timestamp <= 24 * 60 * 60 * 1000);
  if (filter === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return trades.filter(t => t.timestamp >= start.getTime());
  }
  return trades;
}

/**
 * FIFO matching of buys → sells across the full trade history.
 * Returns a map of trade.id → per-trade realized P&L for sell entries.
 * Used as a fallback when the backend doesn't send tradePnl (e.g. after a restart).
 */
function computeFrontendPnl(trades: TradeEntry[]): Map<string, number> {
  const pnlMap = new Map<string, number>();
  // Process oldest-first so FIFO order is correct
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);

  // Position keyed by team + market (homeTitle::awayTitle)
  const positions = new Map<string, { totalCost: number; contracts: number; avgPrice: number }>();

  for (const trade of sorted) {
    const key = `${trade.team}::${trade.homeTitle ?? ''}::${trade.awayTitle ?? ''}`;
    if (trade.action === 'buy') {
      const cost = trade.contracts * trade.price + (trade.fee ?? 0);
      const ex = positions.get(key);
      if (ex) {
        const n = ex.contracts + trade.contracts;
        ex.avgPrice = (ex.totalCost + cost) / n;
        ex.contracts = n;
        ex.totalCost += cost;
      } else {
        positions.set(key, { totalCost: cost, contracts: trade.contracts, avgPrice: cost / trade.contracts });
      }
    } else if (trade.action === 'sell') {
      const pos = positions.get(key);
      if (pos && pos.contracts > 0) {
        const net = trade.contracts * trade.price - (trade.fee ?? 0);
        const costBasis = trade.contracts * pos.avgPrice;
        pnlMap.set(trade.id, net - costBasis);
        pos.contracts -= trade.contracts;
        pos.totalCost = pos.contracts > 0 ? pos.contracts * pos.avgPrice : 0;
        if (pos.contracts <= 0) positions.delete(key);
      }
    }
  }
  return pnlMap;
}

function PlatformBadge({ platform }: { platform: 'poly' | 'kalshi' }) {
  return (
    <img
      src={platform === 'kalshi' ? kalshiLogo : polyLogo}
      alt={platform}
      className="platform-badge"
    />
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${time}.${ms}`;
}

function TradeRow({ trade, fallbackPnl }: { trade: TradeEntry; fallbackPnl?: number }) {
  const isBuy = trade.action === 'buy';
  const teamLabel = trade.team === 'home'
    ? (trade.homeTitle ?? 'Home')
    : (trade.awayTitle ?? 'Away');

  const priceDisplay = `${(trade.price * 100).toFixed(0)}¢`;
  const feeDisplay = trade.fee != null ? ` · $${trade.fee.toFixed(2)} fee` : '';
  const latencyDisplay = trade.latencyMs != null ? ` · ${trade.latencyMs}ms` : '';

  // Per-trade financial summary — use backend value if present, else frontend FIFO computation
  const buyCost = isBuy ? trade.contracts * trade.price + (trade.fee ?? 0) : null;
  const effectivePnl = !isBuy ? (trade.tradePnl ?? fallbackPnl) : null;
  const tradePnlDisplay = effectivePnl != null
    ? effectivePnl >= 0
      ? `+$${effectivePnl.toFixed(2)}`
      : `-$${Math.abs(effectivePnl).toFixed(2)}`
    : null;

  return (
    <div className={`trade-row ${trade.sim ? 'trade-row-sim' : ''}`}>
      <div className="trade-left">
        <img
          src={isBuy ? buyIcon : sellIcon}
          alt={isBuy ? 'Buy' : 'Sell'}
          className="trade-icon"
        />
        <div className="trade-info">
          <div className="trade-action-row">
            <span className={`trade-action ${isBuy ? 'action-buy' : 'action-sell'}`}>
              {isBuy ? 'Bought' : 'Sold'} {teamLabel}
              {trade.sim && <span className="sim-badge">SIM</span>}
            </span>
            {tradePnlDisplay != null && (
              <span className={`trade-pnl-badge ${effectivePnl! >= 0 ? 'trade-pnl-pos' : 'trade-pnl-neg'}`}>
                P&L {tradePnlDisplay}
              </span>
            )}
            {tradePnlDisplay == null && buyCost != null && (
              <span className="trade-pnl-badge trade-pnl-cost">cost ${buyCost.toFixed(2)}</span>
            )}
          </div>
          <span className="trade-details">
            {trade.contracts} contracts @ {priceDisplay}{feeDisplay}{latencyDisplay}
          </span>
        </div>
      </div>
      <div className="trade-right">
        <div className="trade-matchup">
          {trade.homeTitle && trade.awayTitle ? (
            <>
              <div className="matchup-team">
                <span className="matchup-name">{trade.homeTitle}</span>
              </div>
              <span className="matchup-vs">VS</span>
              <div className="matchup-team">
                <span className="matchup-name">{trade.awayTitle}</span>
              </div>
            </>
          ) : trade.marketDesc ? (
            <span className="matchup-name">{trade.marketDesc}</span>
          ) : (
            <span className="matchup-name" style={{ color: '#555' }}>—</span>
          )}
        </div>
      </div>
      <div className="trade-right-meta">
        <PlatformBadge platform={trade.platform} />
        <span className="trade-time">{formatTime(trade.timestamp)}</span>
      </div>
    </div>
  );
}

// ---- Log terminal ----

function LogTerminal({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom (newest) whenever a log arrives.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [logs.length]);

  return (
    <div className="log-terminal">
      {logs.length === 0 ? (
        <div className="log-empty">Waiting for logs…</div>
      ) : (
        // Reverse so oldest renders first (top), newest last (bottom)
        [...logs].reverse().map((entry, i) => {
          const msg = entry.message.toLowerCase();
          // Highlight order fills (orderid=) and per-trade PnL lines from the PnL tracker
          const isPnlLine = entry.context === 'PnL' && (msg.startsWith('buy ') || msg.startsWith('sell '));
          const isBuy  = (msg.includes('orderid=') && msg.includes('buy'))  || (isPnlLine && msg.startsWith('buy '));
          const isSell = (msg.includes('orderid=') && msg.includes('sell') && !msg.includes('buy')) || (isPnlLine && msg.startsWith('sell '));
          const tradeClass = isBuy ? 'log-line-buy' : isSell ? 'log-line-sell' : '';
          return (
            <div key={i} className={`log-line log-level-${entry.level.toLowerCase()} ${tradeClass}`}>
              <span className="log-ts">{entry.ts.slice(11, 23)}</span>
              <span className={`log-level-badge log-level-${entry.level.toLowerCase()}`}>{entry.level}</span>
              <span className="log-ctx">[{entry.context}]</span>
              <span className="log-msg">{entry.message}</span>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ---- Main export ----

export function TradeFeed({ trades, logs }: { trades: TradeEntry[]; logs: LogEntry[] }) {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [showSim, setShowSim] = useState(false);
  const [logMode, setLogMode] = useState(false);

  // Compute P&L for all trades via FIFO matching (fallback when backend doesn't supply it)
  const frontendPnlMap = useMemo(() => computeFrontendPnl(trades), [trades]);

  const filtered = applyFilter(
    showSim ? trades : trades.filter(t => !t.sim),
    filter,
  );

  return (
    <div className="trade-feed">
      <div className="trade-feed-header">
        <h2 className="section-title">Trade Feed</h2>
        <div className="feed-controls">
          {!logMode && (
            <div className="feed-filter-toggle">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`feed-filter-btn ${filter === f.value ? 'active' : ''}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <button
            className={`feed-mode-btn ${showSim ? 'active' : ''}`}
            onClick={() => setShowSim(v => !v)}
            title="Show simulated (test-mode) trades"
          >
            Sim
          </button>
          <button
            className={`feed-mode-btn ${logMode ? 'active' : ''}`}
            onClick={() => setLogMode(v => !v)}
            title="Toggle live backend log view"
          >
            Logs
          </button>
        </div>
      </div>

      {logMode ? (
        <LogTerminal logs={logs} />
      ) : (
        <div className="trade-list">
          {filtered.length === 0 ? (
            <div className="trade-feed-empty">
              {trades.filter(t => showSim || !t.sim).length === 0
                ? 'No trades yet'
                : 'No trades in this period'}
            </div>
          ) : (
            filtered.map((trade) => (
              <TradeRow key={trade.id} trade={trade} fallbackPnl={frontendPnlMap.get(trade.id)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
