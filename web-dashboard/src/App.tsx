import { Performance } from './components/Performance';
import { TradeFeed } from './components/TradeFeed';
import { SourceDelays } from './components/SourceDelays';
import { MarketConfig } from './components/MarketConfig';
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
        <MarketConfig />
      </div>
    </div>
  );
}

export default App;
