import { useState, useRef } from 'react';
import type { DelayDataPoint, SourceDelay } from '../types';
import polyLogo from '../assets/PM Poly.svg';
import kalshiLogo from '../assets/PM Kalshi.svg';
import espnLogo from '../assets/PM ESPN.svg';
import realLogo from '../assets/PM Real.svg';
import './V2SourceDelays.css';

const SOURCE_CONFIG: Record<string, { icon: string; color: string }> = {
  polymarket: { icon: polyLogo, color: '#2E5CFF' },
  kalshi: { icon: kalshiLogo, color: '#21C891' },
  espn: { icon: espnLogo, color: '#E52534' },
  realsports: { icon: realLogo, color: '#868686' },
};

function SparkLine({ color, dataPoints }: { color: string; dataPoints: DelayDataPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DelayDataPoint } | null>(null);

  const max = 10;
  const width = 200;
  const height = 50;
  const stepX = width / (dataPoints.length - 1);

  const points = dataPoints.map((dp, i) => ({
    x: i * stepX,
    y: height - (dp.delay / max) * height,
  }));

  function catmullRomToBezier(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    const tension = 0.3;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const pathData = catmullRomToBezier(points);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setTooltip({ x: points[closest].x, y: points[closest].y, point: dataPoints[closest] });
  }

  return (
    <div className="v2-delay-chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="v2-delay-svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <line x1="0" y1={height} x2={width} y2={height} stroke="var(--BASE_DARK_4)" strokeWidth="1" />
        <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {tooltip && (
          <>
            <circle cx={tooltip.x} cy={tooltip.y} r="3" fill={color} />
            <line x1={tooltip.x} y1={0} x2={tooltip.x} y2={height} stroke={color} strokeWidth="0.5" opacity="0.3" />
          </>
        )}
      </svg>
      <div className="v2-delay-labels">
        <span className="v2-delay-label">10</span>
        <span className="v2-delay-label">0</span>
      </div>
      {tooltip && (
        <div
          className="v2-delay-tooltip"
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            bottom: `${((height - tooltip.y) / height) * 100 + 10}%`,
          }}
        >
          {tooltip.point.delay.toFixed(1)}s
        </div>
      )}
    </div>
  );
}

function DelayCard({ source }: { source: SourceDelay }) {
  const config = SOURCE_CONFIG[source.source];
  return (
    <div className="v2-delay-card">
      <img src={config.icon} alt={source.source} className="v2-delay-icon" />
      <div className="v2-delay-text">
        <span className="v2-delay-name" style={{ color: config.color }}>{source.label}</span>
        <span className="v2-delay-value">{source.delay}</span>
      </div>
      <div className="v2-delay-chart">
        <SparkLine color={config.color} dataPoints={source.dataPoints} />
      </div>
    </div>
  );
}

export function V2SourceDelays({ delays }: { delays: SourceDelay[] }) {
  return (
    <div className="v2-delays">
      <h2 className="v2-section-label">AVERAGE SOURCE DELAYS</h2>
      <div className="v2-delays-grid">
        {delays.map((d) => (
          <DelayCard key={d.source} source={d} />
        ))}
      </div>
    </div>
  );
}
