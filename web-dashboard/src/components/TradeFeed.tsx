import type { TradeEntry } from '../types';
import buyIcon from '../assets/PM Buy Icon.svg';
import sellIcon from '../assets/PM Sell Icon.svg';
import kalshiLogo from '../assets/PM Kalshi.svg';
import polyLogo from '../assets/PM Poly.svg';
import './TradeFeed.css';

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
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
    <div className="trade-row">
      <div className="trade-left">
        <img
          src={isBuy ? buyIcon : sellIcon}
          alt={isBuy ? 'Buy' : 'Sell'}
          className="trade-icon"
        />
        <div className="trade-info">
          <span className={`trade-action ${isBuy ? 'action-buy' : 'action-sell'}`}>
            {isBuy ? 'Bought' : 'Sold'} {teamLabel}
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
        <div className="trade-right-meta">
          <PlatformBadge platform={trade.platform} />
          <span className="trade-time">{formatTime(trade.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

export function TradeFeed({ trades }: { trades: TradeEntry[] }) {
  return (
    <div className="trade-feed">
      <h2 className="section-title">Trade Feed</h2>
      <div className="trade-list">
        {trades.length === 0 ? (
          <div className="trade-feed-empty">No trades yet this session</div>
        ) : (
          trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))
        )}
      </div>
    </div>
  );
}
