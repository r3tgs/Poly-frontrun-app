import { useState, useRef } from 'react';
import type { DelayDataPoint, SourceDelay } from '../types';
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

function SparkLine({ color, dataPoints }: { color: string; dataPoints: DelayDataPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DelayDataPoint } | null>(null);

  const max = 10;
  const width = 200;
  const height = 50;
  const paddingRight = 28;
  const chartWidth = width - paddingRight;
  const stepX = chartWidth / (dataPoints.length - 1);

  const points = dataPoints.map((dp, i) => ({
    x: i * stepX,
    y: height - (dp.delay / max) * height,
  }));

  // Build smooth path with rounded corners using cardinal spline
  const pathParts: string[] = [`M${points[0].x},${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    pathParts.push(`L${points[i].x},${points[i].y}`);
  }
  const pathData = pathParts.join(' ');

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    // Find closest point
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mouseX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    setTooltip({ x: points[closest].x, y: points[closest].y, point: dataPoints[closest] });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  return (
    <div className="delay-chart-wrapper">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="delay-chart-svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Baseline */}
        <line x1="0" y1={height} x2={chartWidth} y2={height} stroke="#232327" strokeWidth="1" />
        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Hover indicator */}
        {tooltip && (
          <>
            <circle cx={tooltip.x} cy={tooltip.y} r="3" fill={color} />
            <line x1={tooltip.x} y1={0} x2={tooltip.x} y2={height} stroke={color} strokeWidth="0.5" opacity="0.3" />
          </>
        )}
      </svg>
      <div className="delay-chart-labels">
        <span className="delay-chart-label">10</span>
        <span className="delay-chart-label">0</span>
      </div>
      {tooltip && (
        <div
          className="delay-tooltip"
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
    <div className="delay-card">
      <img src={config.icon} alt={source.source} className="delay-card-icon" />
      <div className="delay-card-text">
        <span className="delay-card-label" style={{ color: config.color }}>
          {source.label}
        </span>
        <span className="delay-card-value">{source.delay}</span>
      </div>
      <div className="delay-card-chart">
        <SparkLine color={config.color} dataPoints={source.dataPoints} />
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
