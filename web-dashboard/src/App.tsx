import { Performance } from './components/Performance';
import { TradeFeed } from './components/TradeFeed';
import { SourceDelays } from './components/SourceDelays';
import { LiveInstances } from './components/LiveInstances';
import { mockStats, mockCalendarData, mockTrades, mockSourceDelays, mockInstances } from './mocks/data';
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
        <LiveInstances instances={mockInstances} />
      </div>
    </div>
  );
}

export default App;
