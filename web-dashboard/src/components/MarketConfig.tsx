import { useState, useEffect } from 'react';
import './MarketConfig.css';

const BOT_URL = 'https://pm-frontrun-snowy-waterfall-1028.fly.dev';

interface SearchResult {
  eventTitle: string;
  eventTicker: string;
  homeKalshiTicker: string;
  homeTitle: string;
  awayKalshiTicker: string;
  awayTitle: string;
}

interface ActiveMarket {
  homeKalshiTicker?: string;
  awayKalshiTicker?: string;
}

export function MarketConfig() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMarket, setActiveMarket] = useState<ActiveMarket | null>(null);
  const [settingTicker, setSettingTicker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BOT_URL}/active-market`)
      .then((r) => r.json())
      .then((m) => { if (m) setActiveMarket(m); })
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const resp = await fetch(`${BOT_URL}/search-markets?q=${encodeURIComponent(q)}`);
      const data = await resp.json();
      if (Array.isArray(data)) {
        setResults(data);
        if (data.length === 0) setError('No markets found. Try a different keyword.');
      } else {
        setError('Search failed.');
      }
    } catch {
      setError('Could not reach bot server.');
    } finally {
      setLoading(false);
    }
  };

  const handleSet = async (result: SearchResult) => {
    setSettingTicker(result.eventTicker);
    try {
      await fetch(`${BOT_URL}/configure-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeKalshiTicker: result.homeKalshiTicker,
          awayKalshiTicker: result.awayKalshiTicker,
        }),
      });
      setActiveMarket({
        homeKalshiTicker: result.homeKalshiTicker,
        awayKalshiTicker: result.awayKalshiTicker,
      });
      setResults([]);
      setQuery('');
    } catch {
      setError('Failed to configure market.');
    } finally {
      setSettingTicker(null);
    }
  };

  return (
    <div className="market-config">
      <h2 className="section-title">Active Market</h2>

      <div className="active-market-card">
        {activeMarket?.homeKalshiTicker ? (
          <div className="active-market-tickers">
            <div className="active-ticker-row">
              <span className="active-ticker-label">Home</span>
              <span className="active-ticker-value">{activeMarket.homeKalshiTicker}</span>
            </div>
            <div className="active-ticker-row">
              <span className="active-ticker-label">Away</span>
              <span className="active-ticker-value">{activeMarket.awayKalshiTicker}</span>
            </div>
          </div>
        ) : (
          <span className="active-market-empty">No market configured</span>
        )}
      </div>

      <div className="market-search-row">
        <input
          className="market-search-input"
          type="text"
          placeholder="Search team or event…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button className="market-search-btn" onClick={handleSearch} disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {error && <p className="market-error">{error}</p>}

      {results.length > 0 && (
        <div className="market-results">
          {results.map((r) => (
            <div key={r.eventTicker} className="market-result-item">
              <div className="market-result-title">{r.eventTitle}</div>
              <div className="market-result-teams">
                <span className="market-result-team">{r.homeTitle || r.homeKalshiTicker}</span>
                <span className="market-result-vs">vs</span>
                <span className="market-result-team">{r.awayTitle || r.awayKalshiTicker}</span>
              </div>
              <button
                className="market-set-btn"
                onClick={() => handleSet(r)}
                disabled={settingTicker === r.eventTicker}
              >
                {settingTicker === r.eventTicker ? 'Setting…' : 'Set'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
