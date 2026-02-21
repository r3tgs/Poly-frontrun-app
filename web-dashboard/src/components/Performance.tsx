import { useState } from 'react';
import type { DayData, PerformanceStats, Period } from '../types';
import chevronIcon from '../assets/PM chevron.svg';
import './Performance.css';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const PERIODS: Period[] = ['Month', 'Week', 'Day'];

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
    <div className="stats-row">
      <div className="stat-item">
        <span className="stat-label">Realized P&L</span>
        <div className="stat-value-row">
          <span
            className="stat-value"
            style={{ color: stats.totalProfit >= 0 ? '#15DF83' : '#F63658' }}
          >
            {formatProfit(stats.totalProfit)}
          </span>
          {stats.profitChange != null && stats.profitChange !== 0 && (
            <span className="stat-change positive">
              <img src={chevronIcon} alt="" className="stat-chevron" />
              {stats.profitChange}%
            </span>
          )}
        </div>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-label">ROI</span>
        <div className="stat-value-row">
          <span
            className="stat-value"
            style={{ color: stats.roi >= 0 ? '#15DF83' : '#F63658' }}
          >
            {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
          </span>
          {stats.roiChange != null && stats.roiChange !== 0 && (
            <span className="stat-change positive">
              <img src={chevronIcon} alt="" className="stat-chevron" />
              {stats.roiChange}%
            </span>
          )}
        </div>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-label">Total Trades</span>
        <div className="stat-value-row">
          <span className="stat-value">{stats.totalBets}</span>
        </div>
      </div>
    </div>
  );
}

function PeriodToggle({
  active,
  onChange,
}: {
  active: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="period-toggle">
      {PERIODS.map((p) => (
        <button
          key={p}
          className={`period-btn ${active === p ? 'active' : ''}`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
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
    if (!d.isCurrentMonth) return 'calendar-cell cell-dimmed';
    if (d.pnl > 0) {
      return `calendar-cell ${d.pnl >= avgProfit ? 'cell-positive-high' : 'cell-positive-low'}`;
    }
    if (d.pnl < 0) {
      return `calendar-cell ${Math.abs(d.pnl) >= avgLoss ? 'cell-negative-high' : 'cell-negative-low'}`;
    }
    return 'calendar-cell cell-zero';
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        {WEEKDAYS.map((day, i) => (
          <div key={i} className="calendar-weekday">
            {day}
          </div>
        ))}
      </div>
      <div className="calendar-grid">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="calendar-row">
            {row.map((d, i) => {
              const isPositive = d.pnl > 0;
              const isNegative = d.pnl < 0;

              return (
                <div key={i} className={getCellClass(d)}>
                  <span
                    className={`cell-day ${
                      d.isCurrentMonth && isPositive
                        ? 'day-positive'
                        : d.isCurrentMonth && isNegative
                          ? 'day-negative'
                          : ''
                    }`}
                  >
                    {d.day}
                  </span>
                  {d.isCurrentMonth && (
                    <span
                      className={`cell-pnl ${
                        isPositive ? 'pnl-positive' : isNegative ? 'pnl-negative' : 'pnl-zero'
                      }`}
                    >
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

export function Performance({
  stats,
  calendarData,
}: {
  stats: PerformanceStats;
  calendarData: DayData[];
}) {
  const [period, setPeriod] = useState<Period>('Month');

  return (
    <div className="performance">
      <div className="performance-header">
        <h2 className="section-title">Performance</h2>
      </div>
      <div className="performance-top-row">
        <StatsRow stats={stats} />
        <PeriodToggle active={period} onChange={setPeriod} />
      </div>
      <CalendarHeatmap data={calendarData} />
    </div>
  );
}
