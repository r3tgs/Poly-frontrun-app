import { useMemo, useRef } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PricePoint, KalshiTrade } from '../types';
import './PriceChart.css';

const HOME_COLOR = '#C8C8C8';
const AWAY_COLOR = '#787878';

interface ChartPoint {
  ts: number;
  homePrice?: number;
  awayPrice?: number;
}

interface Props {
  homeTicker: string;
  awayTicker: string;         // same as homeTicker for binary markets
  homeTitle?: string;
  awayTitle?: string;
  homeHistory: PricePoint[];
  awayHistory: PricePoint[];  // empty for binary — derived as 100 - homePrice
  orderFeed: KalshiTrade[];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

function CustomTooltip({ active, payload, homeTitle, awayTitle }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ChartPoint;
  return (
    <div className="pc-tooltip">
      <div className="pc-tooltip-time">{new Date(p.ts).toLocaleTimeString()}</div>
      {p.homePrice !== undefined && (
        <div className="pc-tooltip-row" style={{ color: HOME_COLOR }}>
          {homeTitle ?? 'Home'}: {p.homePrice}%
        </div>
      )}
      {p.awayPrice !== undefined && (
        <div className="pc-tooltip-row" style={{ color: AWAY_COLOR }}>
          {awayTitle ?? 'Away'}: {p.awayPrice}%
        </div>
      )}
    </div>
  );
}

function CustomLegend({ homeTitle, awayTitle }: { homeTitle?: string; awayTitle?: string }) {
  return (
    <div className="pc-legend">
      <span className="pc-legend-item" style={{ color: HOME_COLOR }}>
        ── {homeTitle ?? 'Home'}
      </span>
      <span className="pc-legend-item" style={{ color: AWAY_COLOR }}>
        ── {awayTitle ?? 'Away'}
      </span>
      <span className="pc-legend-sep" />
      <span className="pc-legend-item pc-legend-buy">● Buy</span>
      <span className="pc-legend-item pc-legend-sell">● Sell</span>
    </div>
  );
}

export function PriceChart({
  homeTicker,
  awayTicker,
  homeTitle,
  awayTitle,
  homeHistory,
  awayHistory,
  orderFeed,
}: Props) {
  const isBinary = homeTicker === awayTicker;
  const hasMarket = !!homeTicker;

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!homeTicker) return [];

    const homeMap = new Map<number, number>();
    const awayMap = new Map<number, number>();

    for (const p of homeHistory) homeMap.set(p.ts, p.price);
    for (const p of awayHistory) awayMap.set(p.ts, p.price);

    // For binary markets, derive away from home
    if (isBinary) {
      for (const [ts, price] of homeMap) awayMap.set(ts, 100 - price);
    }

    const allTs = new Set([...homeMap.keys(), ...awayMap.keys()]);
    return [...allTs]
      .sort((a, b) => a - b)
      .map(ts => ({ ts, homePrice: homeMap.get(ts), awayPrice: awayMap.get(ts) }));
  }, [homeHistory, awayHistory, homeTicker, awayTicker, isBinary]);

  // Own trade markers — filtered to current market's tickers only
  const ownTradeMarkers = useMemo(() => {
    const buys: { tradeId: string; ts: number; price: number; count: number }[] = [];
    const sells: { tradeId: string; ts: number; price: number; count: number }[] = [];

    for (const t of orderFeed) {
      if (!t.isOwn) continue;
      if (t.ticker !== homeTicker && t.ticker !== awayTicker) continue;
      const ts = Math.floor(t.timestamp / 1000) * 1000;
      const price = isBinary
        ? (t.ownSide === 'no' ? 100 - t.yesPrice : t.yesPrice)
        : t.yesPrice;

      const marker = { tradeId: t.tradeId, ts, price, count: t.count };
      if (t.action === 'buy') buys.push(marker);
      else if (t.action === 'sell') sells.push(marker);
    }
    return { buys, sells };
  }, [orderFeed, homeTicker, awayTicker, isBinary]);

  const hasData = chartData.length > 0;
  const lastHome = [...chartData].reverse().find(p => p.homePrice !== undefined)?.homePrice;
  const lastAway = [...chartData].reverse().find(p => p.awayPrice !== undefined)?.awayPrice;

  /**
   * Extend the right domain so ReferenceDots for very recent own trades
   * are never clipped. Only considers trades on the current market's tickers.
   */
  const ownMaxTs = useMemo(() => {
    const ts = orderFeed
      .filter(t => t.isOwn && (t.ticker === homeTicker || t.ticker === awayTicker))
      .map(t => Math.floor(t.timestamp / 1000) * 1000);
    return ts.length > 0 ? Math.max(...ts) + 60_000 : null;
  }, [orderFeed, homeTicker, awayTicker]);

  /**
   * Locked game-start timestamp — pinned once a price breakout is first detected
   * so the left edge never creeps right as new data arrives.
   * Keyed by "homeTicker::awayTicker" so a new market resets it automatically.
   *
   * NOTE: we intentionally do NOT factor own-trade timestamps into this value.
   * Doing so caused empty left-side gaps when stale own-trade entries from
   * previous sessions (same ticker, different day) pulled the start far into
   * the past. Own trades are always during active game time, so they're always
   * within the candle window anyway.
   */
  const lockedStartRef = useRef<{ key: string; ts: number } | null>(null);

  const activeStartTs = useMemo<number>(() => {
    const marketKey = `${homeTicker}::${awayTicker}`;

    if (lockedStartRef.current?.key === marketKey) {
      return lockedStartRef.current.ts;
    }

    const pts = homeHistory.length > 0 ? homeHistory : awayHistory;
    let start: number;
    let foundBreakout = false;

    if (pts.length < 10) {
      start = pts[0]?.ts ?? Date.now() - 3 * 60 * 60 * 1000;
    } else {
      const baseCount = Math.min(15, Math.max(5, Math.floor(pts.length * 0.1)));
      const baseline = pts.slice(0, baseCount).reduce((s, p) => s + p.price, 0) / baseCount;
      const BREAKOUT = 5;
      const LEAD_MS = 5 * 60 * 1000;
      start = pts[0].ts;
      for (let i = baseCount; i < pts.length; i++) {
        if (Math.abs(pts[i].price - baseline) >= BREAKOUT) {
          start = Math.max(pts[0].ts, pts[i].ts - LEAD_MS);
          foundBreakout = true;
          break;
        }
      }
    }

    if (foundBreakout) {
      lockedStartRef.current = { key: marketKey, ts: start };
    }

    return start;
  }, [homeHistory, awayHistory, homeTicker, awayTicker]);

  /**
   * Filter chart data to the active window then trim any leading points that
   * have no price data (price=0 placeholders from before trading opens).
   * Passing this filtered array — not an explicit domain — as `data` to
   * ComposedChart means recharts derives its left edge from `'dataMin'`,
   * which always equals displayChartData[0].ts. This makes an empty left
   * gap geometrically impossible regardless of own-trade timestamps.
   */
  const displayChartData = useMemo(() => {
    const windowed = chartData.filter(p => p.ts >= activeStartTs);
    // Skip leading all-undefined points (zero-price pre-game candles)
    const firstReal = windowed.findIndex(
      p => p.homePrice !== undefined || p.awayPrice !== undefined,
    );
    return firstReal > 0 ? windowed.slice(firstReal) : windowed;
  }, [chartData, activeStartTs]);

  if (!hasMarket) {
    return (
      <div className="price-chart price-chart-empty">
        <h2 className="section-title">Price Chart</h2>
        <div className="pc-empty">Configure a market to see the price chart</div>
      </div>
    );
  }

  return (
    <div className="price-chart">
      <div className="pc-header">
        <h2 className="section-title">Price Chart</h2>
        <div className="pc-header-prices">
          {lastHome !== undefined && (
            <span className="pc-cur-price" style={{ color: HOME_COLOR }}>
              {homeTitle ?? 'Home'} {lastHome}%
            </span>
          )}
          {lastAway !== undefined && (
            <span className="pc-cur-price" style={{ color: AWAY_COLOR }}>
              {awayTitle ?? 'Away'} {lastAway}%
            </span>
          )}
        </div>
      </div>

      <CustomLegend homeTitle={homeTitle} awayTitle={awayTitle} />

      <div className="pc-area">
        {!hasData ? (
          <div className="pc-empty pc-empty-chart">Waiting for price data…</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={displayChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', (dataMax: number) => ownMaxTs !== null ? Math.max(dataMax, ownMaxTs) : dataMax]}
                tickFormatter={formatTime}
                tick={{ fill: '#5A5A5A', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={80}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: '#5A5A5A', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<CustomTooltip homeTitle={homeTitle} awayTitle={awayTitle} />} />
              <Legend content={<></>} /> {/* suppress recharts default legend */}

              {/* Home team line */}
              <Line
                type="stepAfter"
                dataKey="homePrice"
                stroke={HOME_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: HOME_COLOR, stroke: 'none' }}
                connectNulls
                isAnimationActive={false}
              />

              {/* Away team line */}
              <Line
                type="stepAfter"
                dataKey="awayPrice"
                stroke={AWAY_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: AWAY_COLOR, stroke: 'none' }}
                connectNulls
                isAnimationActive={false}
              />

              {/* Own buy markers */}
              {ownTradeMarkers.buys.map(m => (
                <ReferenceDot
                  key={`buy-${m.tradeId}`}
                  x={m.ts}
                  y={m.price}
                  r={6}
                  fill="#15DF83"
                  stroke="#0A1F15"
                  strokeWidth={2}
                  label={{ value: `${m.count}`, fill: '#15DF83', fontSize: 9, dy: -12 }}
                />
              ))}

              {/* Own sell markers */}
              {ownTradeMarkers.sells.map(m => (
                <ReferenceDot
                  key={`sell-${m.tradeId}`}
                  x={m.ts}
                  y={m.price}
                  r={6}
                  fill="#F63658"
                  stroke="#1F0A10"
                  strokeWidth={2}
                  label={{ value: `${m.count}`, fill: '#F63658', fontSize: 9, dy: -12 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
