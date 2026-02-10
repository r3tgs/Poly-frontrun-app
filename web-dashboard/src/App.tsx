import { Performance } from './components/Performance';
import { TradeFeed } from './components/TradeFeed';
import { SourceDelays } from './components/SourceDelays';
import { mockStats, mockCalendarData, mockTrades, mockSourceDelays } from './mocks/data';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="left-column">
        <Performance stats={mockStats} calendarData={mockCalendarData} />
        <TradeFeed trades={mockTrades} />
      </div>
      <div className="right-column">
        <SourceDelays delays={mockSourceDelays} />
        <div className="placeholder-card">
          <span className="placeholder-text">Live instances</span>
        </div>
      </div>
    </div>
  );
}

export default App;
