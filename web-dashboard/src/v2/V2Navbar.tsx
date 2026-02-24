import type { PhoneClient } from '../types';
import kalshiLogo from './assets/PM Kalshi.svg';
import polyLogo from './assets/PM Poly.svg';
import instanceIcon from './assets/PM Instance Icon.svg';
import './V2Navbar.css';

interface V2NavbarProps {
  activeTab: 'home' | 'live';
  onTabChange: (tab: 'home' | 'live') => void;
  wsStatus: 'connecting' | 'connected' | 'disconnected';
  phones: PhoneClient[];
}

export function V2Navbar({ activeTab, onTabChange, wsStatus, phones }: V2NavbarProps) {
  const liveCount = phones.filter(p => p.connected !== false).length;

  return (
    <nav className="v2-navbar">
      <div className="v2-navbar-left">
        <div className="v2-navbar-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 2L4.09 12.62C3.74 13.04 3.96 13.67 4.48 13.78L11 15.25L10 22L18.91 11.38C19.26 10.96 19.04 10.33 18.52 10.22L12 8.75L13 2Z"
              fill="var(--PRIMARY_GREEN)"
            />
          </svg>
        </div>
        <div className="v2-nav-tabs">
          <button
            className={`v2-nav-tab ${activeTab === 'home' ? 'v2-nav-tab-active' : ''}`}
            onClick={() => onTabChange('home')}
          >
            HOME
          </button>
          <button
            className={`v2-nav-tab ${activeTab === 'live' ? 'v2-nav-tab-active' : ''}`}
            onClick={() => onTabChange('live')}
          >
            LIVE
          </button>
        </div>
      </div>

      <div className="v2-navbar-center">
        <div className="v2-platform-status">
          <img src={kalshiLogo} alt="Kalshi" className="v2-platform-icon" />
          <span className="v2-platform-name">Kalshi</span>
          {wsStatus === 'connected' && <span className="v2-platform-dot v2-dot-connected" />}
        </div>
        <span className="v2-platform-divider">/</span>
        <div className="v2-platform-status">
          <img src={polyLogo} alt="Polymarket" className="v2-platform-icon" />
          <span className="v2-platform-name">Polymarket</span>
        </div>
      </div>

      <div className="v2-navbar-right">
        {liveCount > 0 && (
          <div className="v2-live-badge">
            <img src={instanceIcon} alt="" className="v2-live-badge-icon" />
            <span>{liveCount} LIVE INSTANCE{liveCount !== 1 ? 'S' : ''}</span>
          </div>
        )}
      </div>
    </nav>
  );
}
