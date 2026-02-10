import type { DayData, DelayDataPoint, PerformanceStats, SourceDelay, TradeEntry } from '../types';

export const mockStats: PerformanceStats = {
  totalProfit: 16490,
  profitChange: 15,
  roi: 8.4,
  roiChange: 1.2,
  totalBets: 18,
};

export const mockCalendarData: DayData[] = [
  // Row 1: Mon 29 - Sun 4 (29-31 are prev month, 1-4 current)
  { day: 29, pnl: 0, isCurrentMonth: false },
  { day: 30, pnl: 0, isCurrentMonth: false },
  { day: 31, pnl: 0, isCurrentMonth: false },
  { day: 1, pnl: 1325, isCurrentMonth: true },
  { day: 2, pnl: 0, isCurrentMonth: true },
  { day: 3, pnl: 1325, isCurrentMonth: true },
  { day: 4, pnl: 0, isCurrentMonth: true },
  // Row 2
  { day: 5, pnl: 0, isCurrentMonth: true },
  { day: 6, pnl: 3725, isCurrentMonth: true },
  { day: 7, pnl: -589, isCurrentMonth: true },
  { day: 8, pnl: 1325, isCurrentMonth: true },
  { day: 9, pnl: 0, isCurrentMonth: true },
  { day: 10, pnl: 0, isCurrentMonth: true },
  { day: 11, pnl: 0, isCurrentMonth: true },
  // Row 3
  { day: 12, pnl: 1325, isCurrentMonth: true },
  { day: 13, pnl: 0, isCurrentMonth: true },
  { day: 14, pnl: 892, isCurrentMonth: true },
  { day: 15, pnl: 0, isCurrentMonth: true },
  { day: 16, pnl: 4253, isCurrentMonth: true },
  { day: 17, pnl: 1325, isCurrentMonth: true },
  { day: 18, pnl: 0, isCurrentMonth: true },
  // Row 4
  { day: 19, pnl: 2325, isCurrentMonth: true },
  { day: 20, pnl: 3095, isCurrentMonth: true },
  { day: 21, pnl: 0, isCurrentMonth: true },
  { day: 22, pnl: 0, isCurrentMonth: true },
  { day: 23, pnl: 0, isCurrentMonth: true },
  { day: 24, pnl: 0, isCurrentMonth: true },
  { day: 25, pnl: 1325, isCurrentMonth: true },
  // Row 5
  { day: 26, pnl: 0, isCurrentMonth: true },
  { day: 27, pnl: 1325, isCurrentMonth: true },
  { day: 28, pnl: 1325, isCurrentMonth: true },
  { day: 29, pnl: 0, isCurrentMonth: true },
  { day: 30, pnl: 1325, isCurrentMonth: true },
  { day: 1, pnl: 0, isCurrentMonth: false },
  { day: 2, pnl: 0, isCurrentMonth: false },
];

// Polymarket: generally low, stable around 3-4s with a gradual drift upward
const polyDelays: DelayDataPoint[] = [
  { time: '8:01', delay: 2.8 }, { time: '8:14', delay: 3.1 }, { time: '8:22', delay: 2.9 },
  { time: '8:35', delay: 3.0 }, { time: '8:41', delay: 3.3 }, { time: '8:55', delay: 3.1 },
  { time: '9:03', delay: 3.5 }, { time: '9:18', delay: 3.4 }, { time: '9:25', delay: 3.8 },
  { time: '9:40', delay: 4.1 }, { time: '9:52', delay: 3.9 }, { time: '10:05', delay: 4.5 },
  { time: '10:18', delay: 4.2 }, { time: '10:30', delay: 5.8 }, { time: '10:42', delay: 4.9 },
  { time: '10:55', delay: 5.2 },
];

// Kalshi: tighter range around 4s, very consistent
const kalshiDelays: DelayDataPoint[] = [
  { time: '8:01', delay: 3.8 }, { time: '8:14', delay: 4.0 }, { time: '8:22', delay: 4.1 },
  { time: '8:35', delay: 3.9 }, { time: '8:41', delay: 4.3 }, { time: '8:55', delay: 4.2 },
  { time: '9:03', delay: 4.0 }, { time: '9:18', delay: 4.4 }, { time: '9:25', delay: 4.1 },
  { time: '9:40', delay: 4.5 }, { time: '9:52', delay: 4.3 }, { time: '10:05', delay: 4.6 },
  { time: '10:18', delay: 4.2 }, { time: '10:30', delay: 4.4 }, { time: '10:42', delay: 4.1 },
  { time: '10:55', delay: 4.5 },
];

// ESPN: mostly low ~2s, with a sudden spike mid-game then recovery
const espnDelays: DelayDataPoint[] = [
  { time: '8:01', delay: 1.5 }, { time: '8:14', delay: 1.8 }, { time: '8:22', delay: 1.6 },
  { time: '8:35', delay: 2.0 }, { time: '8:41', delay: 1.9 }, { time: '8:55', delay: 2.2 },
  { time: '9:03', delay: 2.1 }, { time: '9:18', delay: 2.4 }, { time: '9:25', delay: 2.3 },
  { time: '9:40', delay: 2.5 }, { time: '9:52', delay: 2.8 }, { time: '10:05', delay: 5.9 },
  { time: '10:18', delay: 7.8 }, { time: '10:30', delay: 6.1 }, { time: '10:42', delay: 3.5 },
  { time: '10:55', delay: 2.4 },
];

// Realsports: fluctuates in a wider band 3-6s, no clear trend
const realDelays: DelayDataPoint[] = [
  { time: '8:01', delay: 3.6 }, { time: '8:14', delay: 4.2 }, { time: '8:22', delay: 3.9 },
  { time: '8:35', delay: 5.1 }, { time: '8:41', delay: 4.8 }, { time: '8:55', delay: 4.4 },
  { time: '9:03', delay: 3.7 }, { time: '9:18', delay: 3.5 }, { time: '9:25', delay: 4.6 },
  { time: '9:40', delay: 5.3 }, { time: '9:52', delay: 4.9 }, { time: '10:05', delay: 5.7 },
  { time: '10:18', delay: 5.0 }, { time: '10:30', delay: 4.3 }, { time: '10:42', delay: 3.8 },
  { time: '10:55', delay: 4.1 },
];

export const mockSourceDelays: SourceDelay[] = [
  { source: 'polymarket', label: 'Polymarket Avg. Delay', delay: '4.23s', dataPoints: polyDelays },
  { source: 'kalshi', label: 'Kalshi Avg. Delay', delay: '4.23s', dataPoints: kalshiDelays },
  { source: 'espn', label: 'ESPN Avg. Delay', delay: '4.23s', dataPoints: espnDelays },
  { source: 'realsports', label: 'Realsports.io Avg. Delay', delay: '4.23s', dataPoints: realDelays },
];

export const mockTrades: TradeEntry[] = [
  {
    id: '1',
    action: 'buy',
    team: 'Stars',
    contracts: 100,
    price: 0.67,
    awayAbbr: 'NYC',
    awayName: 'Rangers',
    homeAbbr: 'DAL',
    homeName: 'Stars',
    platform: 'kalshi',
  },
  {
    id: '2',
    action: 'sell',
    team: 'Stars',
    contracts: 100,
    price: 0.54,
    awayAbbr: 'NYC',
    awayName: 'Rangers',
    homeAbbr: 'DAL',
    homeName: 'Stars',
    platform: 'poly',
  },
  {
    id: '3',
    action: 'buy',
    team: 'Stars',
    contracts: 100,
    price: 0.43,
    awayAbbr: 'NYC',
    awayName: 'Rangers',
    homeAbbr: 'DAL',
    homeName: 'Stars',
    platform: 'poly',
  },
  {
    id: '4',
    action: 'sell',
    team: 'Stars',
    contracts: 100,
    price: 0.54,
    awayAbbr: 'NYC',
    awayName: 'Rangers',
    homeAbbr: 'DAL',
    homeName: 'Stars',
    platform: 'poly',
  },
  {
    id: '5',
    action: 'buy',
    team: 'Stars',
    contracts: 100,
    price: 0.43,
    awayAbbr: 'NYC',
    awayName: 'Rangers',
    homeAbbr: 'DAL',
    homeName: 'Stars',
    platform: 'poly',
  },
  {
    id: '6',
    action: 'sell',
    team: 'Stars',
    contracts: 100,
    price: 0.54,
    awayAbbr: 'NYC',
    awayName: 'Rangers',
    homeAbbr: 'DAL',
    homeName: 'Stars',
    platform: 'poly',
  },
];
