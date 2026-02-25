import { useMemo } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './V2EquityCurve.css';

type PnlHistory = Record<string, { realized: number; spent: number; tradeCount: number }>;

interface V2EquityCurveProps {
  pnlHistory: PnlHistory;
  stats: {
    totalProfit: number;
    roi: number;
    totalTrades: number;
  };
}

export function V2EquityCurve({ pnlHistory, stats }: V2EquityCurveProps) {
  const chartData = useMemo(() => {
    const entries = Object.entries(pnlHistory).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) return [];
    let cumulative = 0;
    return entries.map(([date, data]) => {
      cumulative += data.realized;
      return {
        date,
        pnl: cumulative,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      };
    });
  }, [pnlHistory]);

  return (
    <div className="v2-equity">
      <h2 className="v2-section-label">EQUITY CURVE</h2>

      <div className="v2-equity-stats">
        <div className="v2-equity-stat">
          <span className="v2-equity-stat-label">Cumulative PNL</span>
          <span
            className="v2-equity-stat-value"
            style={{
              color: stats.totalProfit >= 0
                ? 'var(--PRIMARY_GREEN)'
                : 'var(--PRIMARY_RED)',
            }}
          >
            ${Math.abs(stats.totalProfit).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
        </div>
        <div className="v2-equity-stat">
          <span className="v2-equity-stat-label">Avg. ROI</span>
          <span
            className="v2-equity-stat-value"
            style={{
              color: stats.roi >= 0
                ? 'var(--PRIMARY_GREEN)'
                : 'var(--PRIMARY_RED)',
            }}
          >
            {stats.roi >= 0 ? '+' : ''}
            {stats.roi.toFixed(1)}%
          </span>
        </div>
        <div className="v2-equity-stat">
          <span className="v2-equity-stat-label">Trades Placed</span>
          <span className="v2-equity-stat-value">{stats.totalTrades}</span>
        </div>
      </div>

      <div className="v2-equity-chart">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="v2EqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(0, 253, 214)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="rgb(0, 253, 214)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgb(75, 75, 77)', fontSize: 11, fontFamily: 'Barlow' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip
                contentStyle={{
                  background: 'rgb(19, 20, 21)',
                  border: '1px solid rgb(40, 40, 44)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontFamily: 'Barlow',
                  fontSize: '13px',
                }}
                formatter={(value: number) => [
                  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  'Cumulative P&L',
                ]}
                labelStyle={{ color: 'rgb(162, 162, 162)' }}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke="rgb(0, 253, 214)"
                strokeWidth={2}
                fill="url(#v2EqGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="v2-equity-empty">No trade data yet</div>
        )}
      </div>
    </div>
  );
}
