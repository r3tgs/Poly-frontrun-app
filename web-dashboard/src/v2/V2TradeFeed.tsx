import { useState, useRef, useEffect, useMemo } from 'react';
import type { TradeEntry, LogEntry } from '../types';
import kalshiLogo from './assets/PM Kalshi Trade Feed.svg';
import polyLogo from './assets/PM Poly Trade Feed.svg';
import './V2TradeFeed.css';

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
  if (filter === '1h') return trades.filter(t => now - t.timestamp <= 3_600_000);
  if (filter === '24h') return trades.filter(t => now - t.timestamp <= 86_400_000);
  if (filter === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return trades.filter(t => t.timestamp >= start.getTime());
  }
  return trades;
}

function computeFrontendPnl(trades: TradeEntry[]): Map<string, number> {
  const pnlMap = new Map<string, number>();
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  const positions = new Map<string, { totalCost: number; contracts: number; avgPrice: number }>();
  for (const trade of sorted) {
    const key = `${trade.team}::${trade.homeTitle ?? ''}::${trade.awayTitle ?? ''}`;
    if (trade.action === 'buy') {
      const cost = trade.contracts * trade.price + (trade.fee ?? 0);
      const ex = positions.get(key);
      if (ex) {
        const n = ex.contracts + trade.contracts;
        ex.avgPrice = (ex.totalCost + cost) / n; ex.contracts = n; ex.totalCost += cost;
      } else {
        positions.set(key, { totalCost: cost, contracts: trade.contracts, avgPrice: cost / trade.contracts });
      }
    } else if (trade.action === 'sell') {
      const pos = positions.get(key);
      if (pos && pos.contracts > 0) {
        const net = trade.contracts * trade.price - (trade.fee ?? 0);
        pnlMap.set(trade.id, net - trade.contracts * pos.avgPrice);
        pos.contracts -= trade.contracts;
        pos.totalCost = pos.contracts > 0 ? pos.contracts * pos.avgPrice : 0;
        if (pos.contracts <= 0) positions.delete(key);
      }
    }
  }
  return pnlMap;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${time}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function TradeRow({ trade, fallbackPnl }: { trade: TradeEntry; fallbackPnl?: number }) {
  const isBuy = trade.action === 'buy';
  const teamLabel = trade.team === 'home' ? (trade.homeTitle ?? 'Home') : (trade.awayTitle ?? 'Away');
  const latency = trade.latencyMs != null ? `${trade.latencyMs}ms` : '';
  const buyCost = isBuy ? trade.contracts * trade.price + (trade.fee ?? 0) : null;
  const effectivePnl = !isBuy ? (trade.tradePnl ?? fallbackPnl) : null;
  const pnlText = effectivePnl != null
    ? (effectivePnl >= 0 ? `+$${effectivePnl.toFixed(2)}` : `-$${Math.abs(effectivePnl).toFixed(2)}`)
    : null;
  const teamsText = trade.homeTitle && trade.awayTitle
    ? `${trade.homeTitle} vs ${trade.awayTitle}`
    : (trade.marketDesc ?? '');

  return (
    <div className={`v2-tf-row ${isBuy ? 'v2-tf-row-buy' : 'v2-tf-row-sell'} ${trade.sim ? 'v2-tf-row-sim' : ''}`}>
      <div className="v2-tf-row1">
        <span className="v2-tf-details">
          {trade.contracts} Contracts @ {(trade.price * 100).toFixed(0)}{'\u00A2'}
        </span>
        <span className="v2-tf-time">{formatTime(trade.timestamp)}</span>
      </div>
      <div className="v2-tf-row2">
        <span className="v2-tf-teams">{teamsText}</span>
      </div>
      <div className="v2-tf-row3">
        <div className="v2-tf-badges">
          <span className={`v2-tf-badge ${isBuy ? 'v2-tf-badge-buy' : 'v2-tf-badge-sell'}`}>
            {isBuy ? 'BUY' : 'SELL'} {teamLabel.toUpperCase()}
            {trade.sim && <span className="v2-tf-sim">SIM</span>}
          </span>
          {pnlText != null && (
            <span className={`v2-tf-badge ${effectivePnl! >= 0 ? 'v2-tf-badge-pos' : 'v2-tf-badge-neg'}`}>
              PNL {pnlText}
            </span>
          )}
          {pnlText == null && buyCost != null && (
            <span className="v2-tf-badge v2-tf-badge-cost">COST ${buyCost.toFixed(2)}</span>
          )}
          {latency && <span className="v2-tf-badge v2-tf-badge-cost">{latency}</span>}
        </div>
        <img src={trade.platform === 'kalshi' ? kalshiLogo : polyLogo} alt="" className="v2-tf-platform" />
      </div>
    </div>
  );
}

function LogTerminal({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'instant' }); }, [logs.length]);

  return (
    <div className="v2-tf-log">
      {logs.length === 0 ? (
        <div className="v2-tf-empty">Waiting for logs...</div>
      ) : (
        [...logs].reverse().map((entry, i) => {
          const msg = entry.message.toLowerCase();
          const isPnlLine = entry.context === 'PnL' && (msg.startsWith('buy ') || msg.startsWith('sell '));
          const isBuy  = (msg.includes('orderid=') && msg.includes('buy'))  || (isPnlLine && msg.startsWith('buy '));
          const isSell = (msg.includes('orderid=') && msg.includes('sell') && !msg.includes('buy')) || (isPnlLine && msg.startsWith('sell '));
          const cls = isBuy ? 'v2-tf-log-buy' : isSell ? 'v2-tf-log-sell' : '';
          return (
            <div key={i} className={`v2-tf-log-line v2-tf-log-${entry.level.toLowerCase()} ${cls}`}>
              <span className="v2-tf-log-ts">{entry.ts.slice(11, 23)}</span>
              <span className={`v2-tf-log-level v2-tf-log-${entry.level.toLowerCase()}`}>{entry.level}</span>
              <span className="v2-tf-log-ctx">[{entry.context}]</span>
              <span className="v2-tf-log-msg">{entry.message}</span>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export function V2TradeFeed({ trades, logs }: { trades: TradeEntry[]; logs: LogEntry[] }) {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [showSim, setShowSim] = useState(false);
  const [logMode, setLogMode] = useState(false);
  const frontendPnlMap = useMemo(() => computeFrontendPnl(trades), [trades]);
  const filtered = applyFilter(showSim ? trades : trades.filter(t => !t.sim), filter);

  return (
    <div className="v2-tf">
      <h2 className="v2-section-label">TRADE FEED</h2>
      <div className="v2-tf-header">
        <div className="v2-tf-controls">
          {!logMode && (
            <div className="v2-tf-filters">
              {FILTERS.map(f => (
                <button key={f.value} className={`v2-tf-filter ${filter === f.value ? 'v2-tf-filter-active' : ''}`} onClick={() => setFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <button className={`v2-tf-mode ${showSim ? 'v2-tf-mode-active' : ''}`} onClick={() => setShowSim(v => !v)}>Sim</button>
          <button className={`v2-tf-mode ${logMode ? 'v2-tf-mode-active' : ''}`} onClick={() => setLogMode(v => !v)}>Logs</button>
        </div>
      </div>
      {logMode ? <LogTerminal logs={logs} /> : (
        <div className="v2-tf-list">
          {filtered.length === 0 ? (
            <div className="v2-tf-empty">
              {trades.filter(t => showSim || !t.sim).length === 0 ? 'No trades yet' : 'No trades in this period'}
            </div>
          ) : filtered.map(trade => (
            <TradeRow key={trade.id} trade={trade} fallbackPnl={frontendPnlMap.get(trade.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
