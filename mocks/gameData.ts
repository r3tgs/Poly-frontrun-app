import { Colors } from '../constants/colors';
import type { GameState, LogEntry, PlatformStatus } from '../types';

export const mockGame: GameState = {
  homeTeam: {
    id: 'dal',
    name: 'Stars',
    abbreviation: 'DAL',
    city: 'Dallas',
    logoColor: Colors.starsLogoBg,
    buttonColor: Colors.starsGreen,
  },
  awayTeam: {
    id: 'nyr',
    name: 'Rangers',
    abbreviation: 'NYC',
    city: 'New York',
    logoColor: Colors.rangersLogoBg,
    buttonColor: Colors.rangersBlue,
  },
  homeScore: 1,
  awayScore: 0,
  isLive: true,
};

export const mockPlatformStatus: PlatformStatus = {
  poly: true,
  kalshi: false,
};

export const mockLogEntries: LogEntry[] = [
  {
    id: '6',
    timestamp: '15:20:23',
    message: 'Sold 100 contracts @ 0.67',
    type: 'sell',
  },
  {
    id: '5',
    timestamp: '15:20:22',
    message: 'Dallas Stars @ 0.67',
    type: 'info',
  },
  {
    id: '4',
    timestamp: '15:20:21',
    message: 'Poly updated score 1-0',
    type: 'info',
  },
  {
    id: '3',
    timestamp: '15:20:15',
    message: 'Bought 100 contracts @ 0.45',
    type: 'trade',
  },
  {
    id: '2',
    timestamp: '15:20:14',
    message: 'Sent to bot',
    type: 'info',
  },
  {
    id: '1',
    timestamp: '15:20:14',
    message: "User selected 'Dallas Stars'",
    type: 'info',
  },
];
