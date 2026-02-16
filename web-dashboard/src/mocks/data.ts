import type { DayData, DelayDataPoint, LiveInstance, PerformanceStats, SourceDelay, TradeEntry } from '../types';

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
  { day: 3, pnl: 2450, isCurrentMonth: true },
  { day: 4, pnl: 0, isCurrentMonth: true },
  // Row 2
  { day: 5, pnl: 890, isCurrentMonth: true },
  { day: 6, pnl: 3725, isCurrentMonth: true },
  { day: 7, pnl: -589, isCurrentMonth: true },
  { day: 8, pnl: 1580, isCurrentMonth: true },
  { day: 9, pnl: 0, isCurrentMonth: true },
  { day: 10, pnl: 2100, isCurrentMonth: true },
  { day: 11, pnl: 0, isCurrentMonth: true },
  // Row 3
  { day: 12, pnl: 1325, isCurrentMonth: true },
  { day: 13, pnl: -1250, isCurrentMonth: true },
  { day: 14, pnl: 892, isCurrentMonth: true },
  { day: 15, pnl: 0, isCurrentMonth: true },
  { day: 16, pnl: 4253, isCurrentMonth: true },
  { day: 17, pnl: 1675, isCurrentMonth: true },
  { day: 18, pnl: 0, isCurrentMonth: true },
  // Row 4
  { day: 19, pnl: 2325, isCurrentMonth: true },
  { day: 20, pnl: 3095, isCurrentMonth: true },
  { day: 21, pnl: 0, isCurrentMonth: true },
  { day: 22, pnl: 1450, isCurrentMonth: true },
  { day: 23, pnl: 0, isCurrentMonth: true },
  { day: 24, pnl: 780, isCurrentMonth: true },
  { day: 25, pnl: 1325, isCurrentMonth: true },
  // Row 5
  { day: 26, pnl: -420, isCurrentMonth: true },
  { day: 27, pnl: 2890, isCurrentMonth: true },
  { day: 28, pnl: 1325, isCurrentMonth: true },
  { day: 29, pnl: 0, isCurrentMonth: true },
  { day: 30, pnl: 1950, isCurrentMonth: true },
  { day: 1, pnl: 0, isCurrentMonth: false },
  { day: 2, pnl: 0, isCurrentMonth: false },
];

const polyDelays: DelayDataPoint[] = [
  { time: '8:01', delay: 3.1 }, { time: '8:14', delay: 4.7 }, { time: '8:22', delay: 5.2 },
  { time: '8:35', delay: 2.8 }, { time: '8:41', delay: 2.3 }, { time: '8:55', delay: 1.6 },
  { time: '9:03', delay: 4.9 }, { time: '9:18', delay: 6.1 }, { time: '9:25', delay: 5.8 },
  { time: '9:40', delay: 7.4 }, { time: '9:52', delay: 3.5 }, { time: '10:05', delay: 2.0 },
  { time: '10:18', delay: 2.7 }, { time: '10:30', delay: 8.3 }, { time: '10:42', delay: 6.9 },
  { time: '10:55', delay: 5.1 },
];

const kalshiDelays: DelayDataPoint[] = [
  { time: '8:01', delay: 4.2 }, { time: '8:14', delay: 3.8 }, { time: '8:22', delay: 5.5 },
  { time: '8:35', delay: 7.1 }, { time: '8:41', delay: 6.6 }, { time: '8:55', delay: 3.0 },
  { time: '9:03', delay: 1.4 }, { time: '9:18', delay: 1.9 }, { time: '9:25', delay: 4.8 },
  { time: '9:40', delay: 8.2 }, { time: '9:52', delay: 7.5 }, { time: '10:05', delay: 6.3 },
  { time: '10:18', delay: 2.7 }, { time: '10:30', delay: 3.4 }, { time: '10:42', delay: 5.0 },
  { time: '10:55', delay: 4.1 },
];

// ESPN: flat baseline with dramatic spike and slow recovery
const espnDelays: DelayDataPoint[] = [
  { time: '8:01', delay: 0.8 }, { time: '8:14', delay: 1.1 }, { time: '8:22', delay: 0.9 },
  { time: '8:35', delay: 1.4 }, { time: '8:41', delay: 1.2 }, { time: '8:55', delay: 1.6 },
  { time: '9:03', delay: 1.3 }, { time: '9:18', delay: 1.8 }, { time: '9:25', delay: 2.0 },
  { time: '9:40', delay: 1.7 }, { time: '9:52', delay: 4.5 }, { time: '10:05', delay: 8.9 },
  { time: '10:18', delay: 7.2 }, { time: '10:30', delay: 9.4 }, { time: '10:42', delay: 5.8 },
  { time: '10:55', delay: 3.1 },
];

// Realsports: generally mid-range with gradual wave pattern
const realDelays: DelayDataPoint[] = [
  { time: '8:01', delay: 4.8 }, { time: '8:14', delay: 5.6 }, { time: '8:22', delay: 6.3 },
  { time: '8:35', delay: 5.9 }, { time: '8:41', delay: 4.2 }, { time: '8:55', delay: 3.1 },
  { time: '9:03', delay: 2.4 }, { time: '9:18', delay: 1.8 }, { time: '9:25', delay: 2.9 },
  { time: '9:40', delay: 4.5 }, { time: '9:52', delay: 6.7 }, { time: '10:05', delay: 7.9 },
  { time: '10:18', delay: 8.5 }, { time: '10:30', delay: 6.2 }, { time: '10:42', delay: 4.0 },
  { time: '10:55', delay: 3.3 },
];

export const mockSourceDelays: SourceDelay[] = [
  { source: 'polymarket', label: 'Polymarket Avg. Delay', delay: '4.23s', dataPoints: polyDelays },
  { source: 'kalshi', label: 'Kalshi Avg. Delay', delay: '4.23s', dataPoints: kalshiDelays },
  { source: 'espn', label: 'ESPN Avg. Delay', delay: '4.23s', dataPoints: espnDelays },
  { source: 'realsports', label: 'Realsports.io Avg. Delay', delay: '4.23s', dataPoints: realDelays },
];

export const mockInstances: LiveInstance[] = [
  { id: '1', device: 'iPhone 16 Pro', location: 'Dallas, TX', status: 'connected' },
  { id: '2', device: 'iPhone 16 Pro', location: 'Dallas, TX', status: 'connected' },
  { id: '3', device: 'iPhone 16 Pro', location: 'Dallas, TX', status: 'disconnected' },
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
    timestamp: '10:42:15 AM',
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
    timestamp: '10:38:47 AM',
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
    timestamp: '10:35:22 AM',
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
    timestamp: '10:31:09 AM',
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
    timestamp: '10:28:33 AM',
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
    timestamp: '10:24:51 AM',
  },
];
