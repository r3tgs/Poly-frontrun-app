import { useState, useEffect } from 'react';
import './TradeSize.css';

const PRESETS = [10, 25, 50, 100];

interface Props {
  wsRef: React.MutableRefObject<WebSocket | null>;
  wsStatus: 'connecting' | 'connected' | 'disconnected';
  /** Server-authoritative default size received via dashboard_state. When set,
   *  it overrides the local display so all devices show the same value. */
  serverDefaultSize: number | null;
}

function sendSize(ws: WebSocket | null, size: number) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'set_default_size', data: { size } }));
  }
}

export function TradeSize({ wsRef, wsStatus, serverDefaultSize }: Props) {
  const [size, setSize] = useState<number>(serverDefaultSize ?? 50);
  const [customVal, setCustomVal] = useState('');

  // Sync to server value whenever it arrives (e.g. page load, reconnect)
  useEffect(() => {
    if (serverDefaultSize != null) setSize(serverDefaultSize);
  }, [serverDefaultSize]);

  // Re-send on every fresh connection so the bot is always in sync
  useEffect(() => {
    if (wsStatus === 'connected') {
      sendSize(wsRef.current, size);
    }
  }, [wsStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySize = (s: number) => {
    setSize(s);
    sendSize(wsRef.current, s);
  };

  const commitCustom = () => {
    const v = parseFloat(customVal);
    if (v > 0) { applySize(v); setCustomVal(''); }
  };

  const isPreset = PRESETS.includes(size);

  return (
    <div className="trade-size">
      <h2 className="section-title">Trade Size</h2>
      <div className="ts-row">
        {PRESETS.map(p => (
          <button
            key={p}
            className={`ts-preset ${size === p ? 'ts-preset-active' : ''}`}
            onClick={() => applySize(p)}
          >
            ${p}
          </button>
        ))}
        <div className={`ts-custom-wrap ${!isPreset ? 'ts-custom-active' : ''}`}>
          <span className="ts-dollar">$</span>
          <input
            className="ts-custom-input"
            type="number"
            min="1"
            placeholder="Custom"
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitCustom(); }}
            onBlur={commitCustom}
          />
        </div>
      </div>
      <div className="ts-current">
        Default: <span className="ts-current-val">${size}</span> per trade
      </div>
    </div>
  );
}
