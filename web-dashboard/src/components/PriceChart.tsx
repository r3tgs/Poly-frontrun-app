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

    // Candle data only — individual order-feed trades are NOT added here because
    // they bounce around the bid/ask spread and produce extreme artificial spikes.
    // Own-trade dots are rendered as ReferenceDots at absolute coordinates instead.
    for (const p of homeHistory) homeMap.set(p.ts, p.price);
    for (const p of awayHistory) awayMap.set(p.ts, p.price);

    // For binary markets, derive away from home
    if (isBinary) {
      for (const [ts, price] of homeMap) awayMap.set(ts, 100 - price);
    }

    // Merge all timestamps into sorted combined array
    const allTs = new Set([...homeMap.keys(), ...awayMap.keys()]);
    return [...allTs]
      .sort((a, b) => a - b)
      .map(ts => ({ ts, homePrice: homeMap.get(ts), awayPrice: awayMap.get(ts) }));
  }, [homeHistory, awayHistory, homeTicker, awayTicker, isBinary]);

  // Own trade markers — placed on the correct line
  const ownTradeMarkers = useMemo(() => {
    const buys: { tradeId: string; ts: number; price: number; count: number }[] = [];
    const sells: { tradeId: string; ts: number; price: number; count: number }[] = [];

    for (const t of orderFeed) {
      if (!t.isOwn) continue;
      // Only show markers for trades on the current market's tickers
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

  // Extend the right domain past the last candle if own trades landed after it,
  // so ReferenceDots for recent executions are never clipped.
  // Only consider trades on the current market's tickers (old sessions pollute timestamps otherwise).
  const ownMaxTs = useMemo(() => {
    const ts = orderFeed
      .filter(t => t.isOwn && (t.ticker === homeTicker || t.ticker === awayTicker))
      .map(t => Math.floor(t.timestamp / 1000) * 1000);
    return ts.length > 0 ? Math.max(...ts) + 60_000 : null;
  }, [orderFeed, homeTicker, awayTicker]);

  /**
   * Locked game-start timestamp — fixed the moment a price breakout is first
   * detected for the current market. Never advances afterward so the X-axis
   * left edge stays pinned (Kalshi LIVE behaviour).
   * Keyed by "homeTicker::awayTicker" so a new market resets it automatically.
   */
  const lockedStartRef = useRef<{ key: string; ts: number } | null>(null);

  const activeStartTs = useMemo<number>(() => {
    const marketKey = `${homeTicker}::${awayTicker}`;

    // Own-trade lower-bound (dots must never be clipped after market ends).
    // Filter to current market's tickers — old sessions have stale timestamps that would
    // push activeStartTs hours into the past and create a huge empty gap on the left.
    const ownTs = orderFeed
      .filter(t => t.isOwn && (t.ticker === homeTicker || t.ticker === awayTicker))
      .map(t => Math.floor(t.timestamp / 1000) * 1000);
    const ownMin = ownTs.length > 0 ? Math.min(...ownTs) - 5 * 60 * 1000 : Infinity;

    // Return locked start for the current market (never advance the left edge).
    if (lockedStartRef.current?.key === marketKey) {
      return Math.min(lockedStartRef.current.ts, ownMin);
    }

    // --- First-time calculation (new market or page load) ---
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

    // Once a real breakout is found, lock the left edge for this market forever.
    if (foundBreakout) {
      lockedStartRef.current = { key: marketKey, ts: start };
    }

    return Math.min(start, ownMin);
  }, [homeHistory, awayHistory, orderFeed, homeTicker, awayTicker]);

  /**
   * Filter chart data to the active window.
   * IMPORTANT: recharts domain prop alone doesn't clip rendered data —
   * we must filter the array directly so the x-axis auto-ticks correctly.
   */
  const visibleChartData = useMemo(
    () => chartData.filter(p => p.ts >= activeStartTs),
    [chartData, activeStartTs],
  );

  /**
   * Actual domain left edge. The locked activeStartTs can land before the
   * first real candle (e.g. the market was quiet at open so those candles
   * get filtered out as price=0). In that case snap to the first candle —
   * UNLESS we have own-trade dots sitting in that empty gap (we need the
   * space to keep them visible).
   */
  const effectiveDomainStart = useMemo(() => {
    const firstTs = visibleChartData[0]?.ts;
    if (!firstTs || firstTs <= activeStartTs) return activeStartTs;
    // There is a gap [activeStartTs, firstTs) with no candles.
    // Keep it only if an own trade dot for the current market lives inside it.
    const hasOwnInGap = orderFeed.some(t => {
      if (!t.isOwn) return false;
      if (t.ticker !== homeTicker && t.ticker !== awayTicker) return false;
      const ts = Math.floor(t.timestamp / 1000) * 1000;
      return ts >= activeStartTs && ts < firstTs;
    });
    return hasOwnInGap ? activeStartTs : firstTs;
  }, [activeStartTs, visibleChartData, orderFeed, homeTicker, awayTicker]);

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
            <ComposedChart data={visibleChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={[effectiveDomainStart, (dataMax: number) => ownMaxTs !== null ? Math.max(dataMax, ownMaxTs) : dataMax]}
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
