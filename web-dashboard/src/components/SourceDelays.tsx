import type { SourceDelay } from '../types';
import polyLogo from '../assets/PM Poly.svg';
import kalshiLogo from '../assets/PM Kalshi.svg';
import espnLogo from '../assets/PM ESPN.svg';
import realLogo from '../assets/PM Real.svg';
import './SourceDelays.css';

const SOURCE_CONFIG: Record<string, { icon: string; color: string }> = {
  polymarket: { icon: polyLogo, color: '#2E5CFF' },
  kalshi: { icon: kalshiLogo, color: '#21C891' },
  espn: { icon: espnLogo, color: '#E52534' },
  realsports: { icon: realLogo, color: '#FEFEFE' },
};

function SparkLine({ color }: { color: string }) {
  // Simple mock sparkline
  const points = [2, 3, 2.5, 4, 3, 5, 4, 6, 3, 7, 5, 4, 6, 8, 5, 7];
  const max = 10;
  const width = 140;
  const height = 40;
  const stepX = width / (points.length - 1);

  const pathData = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - (p / max) * height;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DelayCard({ source }: { source: SourceDelay }) {
  const config = SOURCE_CONFIG[source.source];

  return (
    <div className="delay-card">
      <img src={config.icon} alt={source.source} className="delay-card-icon" />
      <div>
        <span className="delay-card-label" style={{ color: config.color }}>
          {source.label}
        </span>
        <span className="delay-card-value">{source.delay}</span>
      </div>
      <div className="delay-card-chart">
        <SparkLine color={config.color} />
      </div>
    </div>
  );
}

export function SourceDelays({ delays }: { delays: SourceDelay[] }) {
  return (
    <div className="source-delays">
      <h2 className="section-title">Source Delays</h2>
      <div className="source-delays-grid">
        {delays.map((d) => (
          <DelayCard key={d.source} source={d} />
        ))}
      </div>
    </div>
  );
}
