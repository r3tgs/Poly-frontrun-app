import type { TradeEntry } from '../types';
import buyIcon from '../assets/PM Buy Icon.svg';
import sellIcon from '../assets/PM Sell Icon.svg';
import kalshiLogo from '../assets/PM Kalshi.svg';
import polyLogo from '../assets/PM Poly.svg';
import './TradeFeed.css';

function PlatformBadge({ platform, timestamp }: { platform: 'poly' | 'kalshi'; timestamp: string }) {
  return (
    <div className="platform-badge-wrapper">
      <img
        src={platform === 'kalshi' ? kalshiLogo : polyLogo}
        alt={platform}
        className="platform-badge"
      />
      <span className="trade-timestamp">{timestamp}</span>
    </div>
  );
}

function TradeRow({ trade }: { trade: TradeEntry }) {
  const isBuy = trade.action === 'buy';

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
            {isBuy ? 'Bought' : 'Sold'} {trade.team}
          </span>
          <span className="trade-details">
            {trade.contracts} contracts @ {trade.price.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="trade-right">
        <div className="trade-matchup">
          <div className="matchup-team">
            <span className="matchup-abbr">{trade.awayAbbr}</span>
            <span className="matchup-name">{trade.awayName}</span>
          </div>
          <span className="matchup-vs">VS</span>
          <div className="matchup-team">
            <span className="matchup-abbr">{trade.homeAbbr}</span>
            <span className="matchup-name">{trade.homeName}</span>
          </div>
        </div>
        <PlatformBadge platform={trade.platform} timestamp={trade.timestamp} />
      </div>
    </div>
  );
}

export function TradeFeed({ trades }: { trades: TradeEntry[] }) {
  return (
    <div className="trade-feed">
      <h2 className="section-title">Trade Feed</h2>
      <div className="trade-list">
        {trades.map((trade) => (
          <TradeRow key={trade.id} trade={trade} />
        ))}
      </div>
    </div>
  );
}
