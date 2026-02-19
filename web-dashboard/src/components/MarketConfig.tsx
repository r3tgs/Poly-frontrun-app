import { useState, useEffect, useRef, useCallback } from 'react';
import './MarketConfig.css';

const BOT_WS_URL = 'wss://pm-frontrun-snowy-waterfall-1028.fly.dev';
const BOT_HTTP_URL = 'https://pm-frontrun-snowy-waterfall-1028.fly.dev';

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
  description?: string;
}

interface PhoneClient {
  id: string;
  connectedAt: number;
  activeMarket: ActiveMarket | null;
  label?: string;
}

function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function MarketConfig() {
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [phones, setPhones] = useState<PhoneClient[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [settingFor, setSettingFor] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});

  connectRef.current = () => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsStatus('connecting');
    const ws = new WebSocket(BOT_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) { ws.close(); return; }
      setWsStatus('connected');
      ws.send(JSON.stringify({ type: 'register', data: { clientType: 'dashboard' } }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
        if (msg.type === 'clients_update') {
          setPhones(msg.data ?? []);
        }
      } catch {}
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(() => connectRef.current(), 4000);
    };

    ws.onerror = () => {};
  };

  useEffect(() => {
    connectRef.current();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const resp = await fetch(`${BOT_HTTP_URL}/search-markets?q=${encodeURIComponent(q)}`);
      const data = await resp.json();
      if (Array.isArray(data)) {
        setResults(data);
        if (data.length === 0) setSearchError('No markets found.');
      } else {
        setSearchError('Search failed.');
      }
    } catch {
      setSearchError('Could not reach bot server.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleSet = useCallback((phoneId: string, result: SearchResult) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setSettingFor(phoneId);
    ws.send(JSON.stringify({
      type: 'configure_client_market',
      data: {
        clientId: phoneId,
        market: {
          homeKalshiTicker: result.homeKalshiTicker,
          awayKalshiTicker: result.awayKalshiTicker,
          description: result.eventTitle,
        },
      },
    }));
    // Optimistically collapse + clear after a short delay
    setTimeout(() => {
      setSettingFor(null);
      setExpandedId(null);
      setResults([]);
      setQuery('');
    }, 600);
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setResults([]);
      setQuery('');
      setSearchError(null);
    } else {
      setExpandedId(id);
      setResults([]);
      setQuery('');
      setSearchError(null);
    }
  };

  return (
    <div className="market-config">
      <div className="market-config-header">
        <h2 className="section-title">Live Instances</h2>
        <div className={`ws-status-dot ws-status-${wsStatus}`} title={wsStatus} />
      </div>

      {phones.length === 0 ? (
        <div className="instances-empty">
          {wsStatus === 'connected'
            ? 'No phones connected'
            : wsStatus === 'connecting'
            ? 'Connecting to bot…'
            : 'Bot offline — retrying…'}
        </div>
      ) : (
        <div className="instance-list">
          {phones.map((phone) => (
            <div key={phone.id} className="instance-card">
              <div className="instance-header">
                <div className="instance-meta">
                  <span className="instance-id">
                    {phone.label ?? `Phone ${phone.id.slice(0, 8)}`}
                  </span>
                  <span className="instance-time">{timeAgo(phone.connectedAt)}</span>
                </div>
                <button
                  className="instance-configure-btn"
                  onClick={() => toggleExpand(phone.id)}
                >
                  {expandedId === phone.id ? 'Done' : 'Configure'}
                </button>
              </div>

              <div className="instance-market">
                {phone.activeMarket?.homeKalshiTicker ? (
                  <div className="instance-tickers">
                    <span className="instance-ticker-row">
                      <span className="instance-ticker-label">Home</span>
                      <span className="instance-ticker-value">{phone.activeMarket.homeKalshiTicker}</span>
                    </span>
                    <span className="instance-ticker-row">
                      <span className="instance-ticker-label">Away</span>
                      <span className="instance-ticker-value">{phone.activeMarket.awayKalshiTicker}</span>
                    </span>
                  </div>
                ) : (
                  <span className="instance-no-market">No market set</span>
                )}
              </div>

              {expandedId === phone.id && (
                <div className="instance-search-panel">
                  <div className="market-search-row">
                    <input
                      className="market-search-input"
                      type="text"
                      placeholder="Search team or event…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      autoFocus
                    />
                    <button
                      className="market-search-btn"
                      onClick={handleSearch}
                      disabled={searching}
                    >
                      {searching ? '…' : 'Search'}
                    </button>
                  </div>

                  {searchError && <p className="market-error">{searchError}</p>}

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
                            onClick={() => handleSet(phone.id, r)}
                            disabled={settingFor === phone.id}
                          >
                            {settingFor === phone.id ? 'Setting…' : 'Set'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
