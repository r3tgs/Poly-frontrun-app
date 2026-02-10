import type { TradeEntry } from '../types';
import './TradeFeed.css';

function BuyIcon() {
  return (
    <div className="trade-icon trade-icon-buy">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M9 3v12M9 3l4.5 4.5M9 3L4.5 7.5"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="rotate(-45 9 9)"
        />
      </svg>
    </div>
  );
}

function SellIcon() {
  return (
    <div className="trade-icon trade-icon-sell">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M9 15V3M9 15l4.5-4.5M9 15L4.5 10.5"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="rotate(-45 9 9)"
        />
      </svg>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: 'poly' | 'kalshi' }) {
  if (platform === 'kalshi') {
    return (
      <div className="platform-badge platform-kalshi">
        <span>Kalshi</span>
      </div>
    );
  }
  return (
    <div className="platform-badge platform-poly">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
        <path d="M8 0L14.9282 4V12L8 16L1.07179 12V4L8 0Z" fill="#fff" />
      </svg>
    </div>
  );
}

function TradeRow({ trade }: { trade: TradeEntry }) {
  const isBuy = trade.action === 'buy';

  return (
    <div className="trade-row">
      <div className="trade-left">
        {isBuy ? <BuyIcon /> : <SellIcon />}
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
        <PlatformBadge platform={trade.platform} />
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
