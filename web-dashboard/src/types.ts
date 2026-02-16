export interface DayData {
  day: number;
  pnl: number;
  isCurrentMonth: boolean;
}

export interface PerformanceStats {
  totalProfit: number;
  profitChange: number;
  roi: number;
  roiChange: number;
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

export type InstanceStatus = 'connected' | 'disconnected';

export interface LiveInstance {
  id: string;
  device: string;
  location: string;
  status: InstanceStatus;
}

export interface TradeEntry {
  id: string;
  action: TradeAction;
  team: string;
  contracts: number;
  price: number;
  awayAbbr: string;
  awayName: string;
  homeAbbr: string;
  homeName: string;
  platform: Platform;
}
