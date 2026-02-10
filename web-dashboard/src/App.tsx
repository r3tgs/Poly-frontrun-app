import { Performance } from './components/Performance';
import { TradeFeed } from './components/TradeFeed';
import { mockStats, mockCalendarData, mockTrades } from './mocks/data';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="left-column">
        <Performance stats={mockStats} calendarData={mockCalendarData} />
        <TradeFeed trades={mockTrades} />
      </div>
      <div className="right-column">
        <div className="placeholder-card">
          <span className="placeholder-text">Source delays</span>
        </div>
        <div className="placeholder-card">
          <span className="placeholder-text">Live instances</span>
        </div>
      </div>
    </div>
  );
}

export default App;
