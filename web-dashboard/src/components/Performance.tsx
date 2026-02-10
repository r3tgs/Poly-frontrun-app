import { useState } from 'react';
import type { DayData, PerformanceStats, Period } from '../types';
import chevronIcon from '../assets/PM chevron.svg';
import './Performance.css';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const PERIODS: Period[] = ['Month', 'Week', 'Day'];

function formatPnl(value: number): string {
  if (value === 0) return '+0';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toLocaleString()}`;
}

function StatsRow({ stats }: { stats: PerformanceStats }) {
  return (
    <div className="stats-row">
      <div className="stat-item">
        <span className="stat-label">Total Profit</span>
        <div className="stat-value-row">
          <span className="stat-value">${stats.totalProfit.toLocaleString()}</span>
          <span className="stat-change positive">
            <img src={chevronIcon} alt="" className="stat-chevron" />
            {stats.profitChange}%
          </span>
        </div>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-label">ROI</span>
        <div className="stat-value-row">
          <span className="stat-value">{stats.roi}%</span>
          <span className="stat-change positive">
            <img src={chevronIcon} alt="" className="stat-chevron" />
            {stats.roiChange}%
          </span>
        </div>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-label">Total Bets Placed</span>
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
        {data.map((d, i) => {
          const isPositive = d.pnl > 0;
          const isNegative = d.pnl < 0;
          const hasValue = d.pnl !== 0;

          return (
            <div
              key={i}
              className={`calendar-cell ${
                hasValue
                  ? isPositive
                    ? 'cell-positive'
                    : 'cell-negative'
                  : ''
              } ${!d.isCurrentMonth ? 'cell-dimmed' : ''}`}
            >
              <span
                className={`cell-day ${
                  hasValue
                    ? isPositive
                      ? 'day-positive'
                      : 'day-negative'
                    : ''
                }`}
              >
                {d.day}
              </span>
              <span
                className={`cell-pnl ${
                  isPositive ? 'pnl-positive' : isNegative ? 'pnl-negative' : 'pnl-zero'
                }`}
              >
                {formatPnl(d.pnl)}
              </span>
            </div>
          );
        })}
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
