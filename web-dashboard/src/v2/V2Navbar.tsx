import type { PhoneClient } from '../types';
import kalshiLogo from './assets/PM Kalshi Header.svg';
import polyLogo from './assets/PM Poly Header.svg';
import logo from './assets/PM Logo.svg';
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
        <img src={logo} alt="PM" className="v2-navbar-logo" />
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
            <span className="v2-live-badge-dot" />
            <span>{liveCount} LIVE INSTANCE{liveCount !== 1 ? 'S' : ''}</span>
          </div>
        )}
      </div>
    </nav>
  );
}
