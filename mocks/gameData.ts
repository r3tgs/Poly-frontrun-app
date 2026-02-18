import { Colors } from '../constants/colors';
import type { GameState, LogEntry, PlatformStatus } from '../types';

export const mockGame: GameState = {
  homeTeam: {
    id: 'yes',
    name: 'Yes',
    abbreviation: 'YES',
    city: '',
    logoColor: Colors.yesGreen,
    buttonColor: Colors.yesGreen,
  },
  awayTeam: {
    id: 'no',
    name: 'No',
    abbreviation: 'NO',
    city: '',
    logoColor: Colors.noRed,
    buttonColor: Colors.noRed,
  },
  homeScore: 0,
  awayScore: 0,
  isLive: true,
};

export const MARKET_QUESTION = 'US/Israel strikes Iran by Feb 28, 2026?';

export const mockPlatformStatus: PlatformStatus = {
  poly: true,
  kalshi: false,
};

export const mockLogEntries: LogEntry[] = [];
