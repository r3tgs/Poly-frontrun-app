import { useState } from 'react';
import type { DayData, PerformanceStats, Period } from '../types';
import chevronIcon from './assets/PM Chevron Icon.svg';
import './V2Performance.css';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const PERIODS: Period[] = ['Month', 'Week', 'Day'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatPnlCell(value: number): string {
  if (value === 0) return '$0';
  const prefix = value > 0 ? '+$' : '-$';
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function formatProfit(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${value.toFixed(2)}`;
}

function StatsRow({ stats }: { stats: PerformanceStats }) {
  return (
    <div className="v2-perf-stats">
      <div className="v2-perf-stat-item">
        <span className="v2-perf-stat-label">Realized P&L</span>
        <div className="v2-perf-stat-row">
          <span
            className="v2-perf-stat-value"
            style={{ color: stats.totalProfit >= 0 ? 'var(--PRIMARY_GREEN)' : 'var(--PRIMARY_RED)' }}
          >
            {formatProfit(stats.totalProfit)}
          </span>
          {stats.profitChange != null && stats.profitChange !== 0 && (
            <span className="v2-perf-stat-change">
              <img src={chevronIcon} alt="" className="v2-perf-chevron" />
              {stats.profitChange}%
            </span>
          )}
        </div>
      </div>
      <div className="v2-perf-stat-divider" />
      <div className="v2-perf-stat-item">
        <span className="v2-perf-stat-label">ROI</span>
        <div className="v2-perf-stat-row">
          <span
            className="v2-perf-stat-value"
            style={{ color: stats.roi >= 0 ? 'var(--PRIMARY_GREEN)' : 'var(--PRIMARY_RED)' }}
          >
            {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
          </span>
          {stats.roiChange != null && stats.roiChange !== 0 && (
            <span className="v2-perf-stat-change">
              <img src={chevronIcon} alt="" className="v2-perf-chevron" />
              {stats.roiChange}%
            </span>
          )}
        </div>
      </div>
      <div className="v2-perf-stat-divider" />
      <div className="v2-perf-stat-item">
        <span className="v2-perf-stat-label">Total Trades</span>
        <span className="v2-perf-stat-value">{stats.totalBets}</span>
      </div>
    </div>
  );
}

function CalendarHeatmap({ data }: { data: DayData[] }) {
  const currentMonthDays = data.filter((d) => d.isCurrentMonth);
  const profitDays = currentMonthDays.filter((d) => d.pnl > 0);
  const lossDays = currentMonthDays.filter((d) => d.pnl < 0);

  const avgProfit =
    profitDays.length > 0
      ? profitDays.reduce((sum, d) => sum + d.pnl, 0) / profitDays.length
      : 0;
  const avgLoss =
    lossDays.length > 0
      ? lossDays.reduce((sum, d) => sum + Math.abs(d.pnl), 0) / lossDays.length
      : 0;

  const rows: DayData[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    rows.push(data.slice(i, i + 7));
  }

  function getCellClass(d: DayData): string {
    if (!d.isCurrentMonth) return 'v2-cal-cell v2-cal-dimmed';
    if (d.pnl > 0)
      return `v2-cal-cell ${d.pnl >= avgProfit ? 'v2-cal-pos-hi' : 'v2-cal-pos-lo'}`;
    if (d.pnl < 0)
      return `v2-cal-cell ${Math.abs(d.pnl) >= avgLoss ? 'v2-cal-neg-hi' : 'v2-cal-neg-lo'}`;
    return 'v2-cal-cell v2-cal-zero';
  }

  return (
    <div className="v2-cal">
      <div className="v2-cal-header">
        {WEEKDAYS.map((day, i) => (
          <div key={i} className="v2-cal-weekday">{day}</div>
        ))}
      </div>
      <div className="v2-cal-grid">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="v2-cal-row">
            {row.map((d, i) => {
              const pos = d.pnl > 0;
              const neg = d.pnl < 0;
              return (
                <div key={i} className={getCellClass(d)}>
                  <span className={`v2-cal-day ${d.isCurrentMonth && pos ? 'v2-cal-day-pos' : d.isCurrentMonth && neg ? 'v2-cal-day-neg' : ''}`}>
                    {d.day}
                  </span>
                  {d.isCurrentMonth && (
                    <span className={`v2-cal-pnl ${pos ? 'v2-cal-pnl-pos' : neg ? 'v2-cal-pnl-neg' : 'v2-cal-pnl-zero'}`}>
                      {formatPnlCell(d.pnl)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function V2Performance({
  stats,
  calendarData,
}: {
  stats: PerformanceStats;
  calendarData: DayData[];
}) {
  const [period, setPeriod] = useState<Period>('Month');
  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="v2-perf">
      <h2 className="v2-section-label v2-perf-title">
        MONTHLY PERFORMANCE
        <span className="v2-perf-month">{monthLabel}</span>
      </h2>
      <div className="v2-perf-top-row">
        <StatsRow stats={stats} />
        <div className="v2-perf-toggle">
          {PERIODS.map((p) => (
            <button
              key={p}
              className={`v2-perf-toggle-btn ${period === p ? 'v2-perf-toggle-active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <CalendarHeatmap data={calendarData} />
    </div>
  );
}
