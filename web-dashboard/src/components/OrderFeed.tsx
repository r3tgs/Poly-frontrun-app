import { useRef, useEffect } from 'react';
import type { KalshiTrade } from '../types';
import './OrderFeed.css';

interface ActiveMarket {
  homeKalshiTicker?: string;
  awayKalshiTicker?: string;
  homeTitle?: string;
  awayTitle?: string;
}

interface Props {
  trades: KalshiTrade[];
  market: ActiveMarket | null;
}

function formatTs(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const mss = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mss}`;
}

/**
 * Returns a short human-readable label for the outcome of a trade.
 * For binary markets (same ticker for home & away) the YES/NO side already
 * implies the outcome, so we return the matching title.
 * For two-ticker markets we return the appropriate team title.
 */
function outcomeLabel(trade: KalshiTrade, market: ActiveMarket | null): string {
  if (!market) return '';
  const { homeKalshiTicker, awayKalshiTicker, homeTitle, awayTitle } = market;
  if (!homeKalshiTicker && !awayKalshiTicker) return '';

  const isBinary = homeKalshiTicker === awayKalshiTicker;

  if (isBinary) {
    // Same ticker — side indicates outcome.
    return trade.takerSide === 'yes' ? (homeTitle ?? '') : (awayTitle ?? '');
  }

  // Two different tickers.
  if (trade.ticker === homeKalshiTicker) return homeTitle ?? 'Home';
  if (trade.ticker === awayKalshiTicker) return awayTitle ?? 'Away';
  return '';
}

function TradeRow({ trade, market }: { trade: KalshiTrade; market: ActiveMarket | null }) {
  const priceDisplay =
    trade.takerSide === 'yes'
      ? `${trade.yesPrice}¢`
      : `${100 - trade.yesPrice}¢`;

  const label = outcomeLabel(trade, market);

  const rowClass = [
    'of-row',
    trade.isOwn && trade.action === 'buy'  ? 'of-row-own-buy'  : '',
    trade.isOwn && trade.action === 'sell' ? 'of-row-own-sell' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClass}>
      <span className="of-ts">{formatTs(trade.timestamp)}</span>
      <span className={`of-side of-side-${trade.takerSide}`}>
        {trade.takerSide.toUpperCase()}
      </span>
      <span className="of-count">{trade.count}</span>
      <span className="of-price">@ {priceDisplay}</span>
      {label && <span className="of-outcome">{label}</span>}
      {trade.isOwn && (
        <span className={`of-me-badge ${trade.action === 'sell' ? 'of-me-sell' : 'of-me-buy'}`}>
          ME
        </span>
      )}
    </div>
  );
}

export function OrderFeed({ trades, market }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasKalshi = !!(market?.homeKalshiTicker || market?.awayKalshiTicker);

  // Auto-scroll to bottom (newest entry) whenever a new trade arrives.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [trades.length]);

  return (
    <div className="order-feed">
      <div className="of-header">
        <h2 className="section-title">Order Feed</h2>
        <div className="of-live-indicator">
          <span className={`of-dot ${hasKalshi && trades.length > 0 ? 'of-dot-live' : ''}`} />
          <span className="of-live-label">LIVE</span>
        </div>
      </div>

      <div className="of-terminal">
        {!hasKalshi ? (
          <div className="of-empty">No Kalshi market configured</div>
        ) : trades.length === 0 ? (
          <div className="of-empty">Waiting for trades…</div>
        ) : (
          // Render oldest first so newest sits at the bottom (terminal behaviour).
          [...trades].reverse().map((t) => (
            <TradeRow key={t.tradeId} trade={t} market={market} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
