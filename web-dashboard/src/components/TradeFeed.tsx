import { useState, useRef, useEffect } from 'react';
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

function TradeRow({ trade }: { trade: TradeEntry }) {
  const isBuy = trade.action === 'buy';
  const teamLabel = trade.team === 'home'
    ? (trade.homeTitle ?? 'Home')
    : (trade.awayTitle ?? 'Away');

  const priceDisplay = `${(trade.price * 100).toFixed(0)}¢`;
  const feeDisplay = trade.fee != null ? ` · $${trade.fee.toFixed(2)} fee` : '';
  const latencyDisplay = trade.latencyMs != null ? ` · ${trade.latencyMs}ms` : '';

  return (
    <div className={`trade-row ${trade.sim ? 'trade-row-sim' : ''}`}>
      <div className="trade-left">
        <img
          src={isBuy ? buyIcon : sellIcon}
          alt={isBuy ? 'Buy' : 'Sell'}
          className="trade-icon"
        />
        <div className="trade-info">
          <span className={`trade-action ${isBuy ? 'action-buy' : 'action-sell'}`}>
            {isBuy ? 'Bought' : 'Sold'} {teamLabel}
            {trade.sim && <span className="sim-badge">SIM</span>}
          </span>
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

  // Auto-scroll to top (newest) whenever a log arrives — logs are prepended.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [logs.length]);

  return (
    <div className="log-terminal">
      {logs.length === 0 ? (
        <div className="log-empty">Waiting for logs…</div>
      ) : (
        [...logs].reverse().map((entry, i) => (
          <div key={i} className={`log-line log-level-${entry.level.toLowerCase()}`}>
            <span className="log-ts">{entry.ts.slice(11, 23)}</span>
            <span className={`log-level-badge log-level-${entry.level.toLowerCase()}`}>{entry.level}</span>
            <span className="log-ctx">[{entry.context}]</span>
            <span className="log-msg">{entry.message}</span>
          </div>
        ))
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
              <TradeRow key={trade.id} trade={trade} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
