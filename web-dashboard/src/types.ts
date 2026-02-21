export interface DayData {
  day: number;
  pnl: number;
  isCurrentMonth: boolean;
}

export interface PerformanceStats {
  totalProfit: number;
  /** Optional — only shown when historical comparison is available */
  profitChange?: number;
  roi: number;
  /** Optional — only shown when historical comparison is available */
  roiChange?: number;
  totalBets: number;
}

export type Period = 'Month' | 'Week' | 'Day';

export type TradeAction = 'buy' | 'sell';
export type Platform = 'poly' | 'kalshi';

export type Source = 'polymarket' | 'kalshi' | 'espn' | 'realsports';

export interface DelayDataPoint {
  time: string;
  delay: number;
}

export interface SourceDelay {
  source: Source;
  label: string;
  delay: string;
  dataPoints: DelayDataPoint[];
}

export interface TradeEntry {
  id: string;
  action: TradeAction;
  team: 'home' | 'away';
  contracts: number;
  /** Gross fill price in dollars (e.g. 0.19 = 19¢) */
  price: number;
  fee?: number;
  latencyMs?: number;
  /** Human-readable market name e.g. "Stars vs Rangers" */
  marketDesc?: string;
  homeTitle?: string;
  awayTitle?: string;
  platform: Platform;
  timestamp: number;
}

/** Market configuration stored on a connected phone. */
export interface PhoneActiveMarket {
  homeKalshiTicker?: string;
  awayKalshiTicker?: string;
  homeMarketSlug?: string;
  awayMarketSlug?: string;
  homeTokenId?: string;
  awayTokenId?: string;
  description?: string;
  homeTitle?: string;
  awayTitle?: string;
}

/** A connected phone client as reported by the bot server. */
export interface PhoneClient {
  id: string;
  connectedAt: number;
  activeMarket: PhoneActiveMarket | null;
  label?: string;
}
