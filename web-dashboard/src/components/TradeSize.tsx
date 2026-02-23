import { useState } from 'react';
import './TradeSize.css';

const PRESETS = [10, 25, 50, 100];

interface Props {
  size: number;
  onApply: (size: number) => void;
}

export function TradeSize({ size, onApply }: Props) {
  const [customVal, setCustomVal] = useState('');

  const commitCustom = () => {
    const v = parseFloat(customVal);
    if (v > 0) { onApply(v); setCustomVal(''); }
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
            onClick={() => onApply(p)}
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
