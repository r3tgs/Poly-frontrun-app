import { Colors } from '../constants/colors';
import type { GameState, LogEntry, PlatformStatus } from '../types';

export const mockGame: GameState = {
  homeTeam: {
    id: 'yes',
    name: 'Pepperdine',
    abbreviation: 'PEPP',
    city: '',
    logoColor: Colors.yesGreen,
    buttonColor: Colors.yesGreen,
  },
  awayTeam: {
    id: 'no',
    name: 'Portland',
    abbreviation: 'PORT',
    city: '',
    logoColor: Colors.noRed,
    buttonColor: Colors.noRed,
  },
  homeScore: 0,
  awayScore: 0,
  isLive: true,
};

export const MARKET_QUESTION = 'Pepperdine at Portland';

export const mockPlatformStatus: PlatformStatus = {
  poly: true,
  kalshi: false,
};

export const mockLogEntries: LogEntry[] = [];
