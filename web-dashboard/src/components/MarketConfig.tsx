import { useState, useCallback } from 'react';
import type { PhoneClient } from '../types';
import './MarketConfig.css';

const BOT_HTTP_URL = 'https://pm-frontrun-snowy-waterfall-1028.fly.dev';

interface MarketPreview {
  homeKalshiTicker: string;
  homeTitle: string;
  awayKalshiTicker: string;
  awayTitle: string;
  description: string;
}

interface MarketConfigProps {
  wsRef: React.MutableRefObject<WebSocket | null>;
  wsStatus: 'connecting' | 'connected' | 'disconnected';
  phones: PhoneClient[];
}

function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

/** Extract a Kalshi ticker from a URL or raw ticker string. */
function extractTicker(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1].toUpperCase();
  } catch {}
  if (/^[A-Z0-9-]+$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

// ---- Per-phone configure panel ----

interface ConfigurePanelProps {
  phoneId: string;
  onSet: (phoneId: string, preview: MarketPreview) => void;
  isSettingFor: boolean;
}

function ConfigurePanel({ phoneId, onSet, isSettingFor }: ConfigurePanelProps) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<MarketPreview | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const ticker = extractTicker(raw);
    if (!ticker) { setError('Could not extract a ticker from that URL.'); return; }
    setLooking(true);
    setError(null);
    setPreview(null);
    try {
      const resp = await fetch(`${BOT_HTTP_URL}/lookup-market?ticker=${encodeURIComponent(ticker)}`);
      const data = await resp.json();
      if (data.error) { setError(data.error); return; }
      setPreview(data as MarketPreview);
    } catch {
      setError('Could not reach bot server.');
    } finally {
      setLooking(false);
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    setUrl(pasted);
    setTimeout(() => lookup(pasted), 0);
  }, [lookup]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') lookup(url);
  }, [lookup, url]);

  return (
    <div className="instance-search-panel">
      <div className="market-url-row">
        <input
          className="market-search-input"
          type="text"
          placeholder="Paste Kalshi market URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        {!preview && (
          <button
            className="market-search-btn"
            onClick={() => lookup(url)}
            disabled={looking || !url.trim()}
          >
            {looking ? '…' : 'Look up'}
          </button>
        )}
      </div>

      {error && <p className="market-error">{error}</p>}

      {preview && (
        <div className="market-preview">
          <div className="market-preview-title">{preview.description}</div>
          <div className="market-preview-teams">
            <div className="market-preview-team">
              <span className="market-preview-label">Home</span>
              <span className="market-preview-ticker">{preview.homeKalshiTicker}</span>
              {preview.homeTitle && <span className="market-preview-name">{preview.homeTitle}</span>}
            </div>
            <div className="market-preview-vs">vs</div>
            <div className="market-preview-team">
              <span className="market-preview-label">Away</span>
              <span className="market-preview-ticker">{preview.awayKalshiTicker}</span>
              {preview.awayTitle && <span className="market-preview-name">{preview.awayTitle}</span>}
            </div>
          </div>
          <div className="market-preview-actions">
            <button className="market-clear-btn" onClick={() => { setPreview(null); setUrl(''); }}>
              Clear
            </button>
            <button
              className="market-set-btn"
              onClick={() => onSet(phoneId, preview)}
              disabled={isSettingFor}
            >
              {isSettingFor ? 'Setting…' : 'Set Market'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main component ----

export function MarketConfig({ wsRef, wsStatus, phones }: MarketConfigProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settingFor, setSettingFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const handleSet = useCallback((phoneId: string, preview: MarketPreview) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    setSettingFor(phoneId);
    ws.send(JSON.stringify({
      type: 'configure_client_market',
      data: {
        clientId: phoneId,
        market: {
          homeKalshiTicker: preview.homeKalshiTicker,
          awayKalshiTicker: preview.awayKalshiTicker,
          description: preview.description,
          homeTitle: preview.homeTitle,
          awayTitle: preview.awayTitle,
        },
      },
    }));
    setTimeout(() => {
      setSettingFor(null);
      setExpandedId(null);
    }, 600);
  }, [wsRef]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const startEditLabel = (phone: PhoneClient) => {
    setEditingId(phone.id);
    setEditingLabel(phone.label ?? `Phone ${phone.id.slice(0, 8)}`);
  };

  const commitLabel = useCallback((phoneId: string, label: string) => {
    setEditingId(null);
    const trimmed = label.trim();
    if (!trimmed) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'rename_client', data: { clientId: phoneId, label: trimmed } }));
    }
  }, [wsRef]);

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
                  {editingId === phone.id ? (
                    <input
                      className="instance-label-input"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onBlur={() => commitLabel(phone.id, editingLabel)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitLabel(phone.id, editingLabel);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="instance-id"
                      onClick={() => startEditLabel(phone)}
                      title="Click to rename"
                    >
                      {phone.label ?? `Phone ${phone.id.slice(0, 8)}`}
                    </span>
                  )}
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
                <ConfigurePanel
                  phoneId={phone.id}
                  onSet={handleSet}
                  isSettingFor={settingFor === phone.id}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
