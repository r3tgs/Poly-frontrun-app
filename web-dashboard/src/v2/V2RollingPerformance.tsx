import { useMemo } from 'react';
import './V2RollingPerformance.css';

type PnlHistory = Record<string, { realized: number; spent: number; tradeCount: number }>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCellColor(pnl: number): string {
  if (pnl === 0) return 'var(--BASE_DARK_4)';
  if (pnl > 0) {
    if (pnl > 500) return 'var(--PRIMARY_GREEN_70)';
    if (pnl > 100) return 'var(--PRIMARY_GREEN_40)';
    return 'var(--PRIMARY_GREEN_20)';
  }
  if (pnl < -500) return 'var(--PRIMARY_RED_70)';
  if (pnl < -100) return 'var(--PRIMARY_RED_40)';
  return 'var(--PRIMARY_RED_20)';
}

interface CellData {
  date: string;
  pnl: number;
  dayOfWeek: number; // 0=Mon ... 6=Sun
}

export function V2RollingPerformance({ pnlHistory }: { pnlHistory: PnlHistory }) {
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1)); // align Monday

    const weeks: CellData[][] = [];
    const monthLabels: { month: string; col: number }[] = [];
    let currentWeek: CellData[] = [];
    let weekIdx = 0;
    let lastMonth = -1;

    const cursor = new Date(start);
    while (cursor <= today) {
      const jsDow = cursor.getDay();
      const monDow = jsDow === 0 ? 6 : jsDow - 1;

      if (monDow === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }

      if (monDow === 0) {
        const month = cursor.getMonth();
        if (month !== lastMonth) {
          const lastCol = monthLabels.length > 0 ? monthLabels[monthLabels.length - 1].col : -4;
          if (weekIdx - lastCol >= 3) {
            monthLabels.push({ month: MONTHS[month], col: weekIdx });
            lastMonth = month;
          }
        }
      }

      const dateStr = fmtDate(cursor);
      currentWeek.push({
        date: dateStr,
        pnl: pnlHistory[dateStr]?.realized ?? 0,
        dayOfWeek: monDow,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    if (currentWeek.length > 0) weeks.push(currentWeek);

    return { weeks, monthLabels };
  }, [pnlHistory]);

  return (
    <div className="v2-rolling">
      <h2 className="v2-section-label">ROLLING ANNUAL PERFORMANCE</h2>
      <div className="v2-rolling-container">
        <div className="v2-rolling-day-labels">
          <span className="v2-rolling-day" style={{ gridRow: 1 }}>M</span>
          <span className="v2-rolling-day" style={{ gridRow: 3 }}>W</span>
          <span className="v2-rolling-day" style={{ gridRow: 5 }}>F</span>
        </div>
        <div className="v2-rolling-scroll">
          <div className="v2-rolling-months">
            {monthLabels.map((m, i) => (
              <span key={i} className="v2-rolling-month" style={{ left: m.col * 15 }}>
                {m.month}
              </span>
            ))}
          </div>
          <div className="v2-rolling-grid">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="v2-rolling-week">
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    className="v2-rolling-cell"
                    style={{
                      backgroundColor: getCellColor(cell.pnl),
                      gridRow: cell.dayOfWeek + 1,
                    }}
                    title={`${cell.date}: ${cell.pnl >= 0 ? '+' : ''}$${cell.pnl.toFixed(2)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
