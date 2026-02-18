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

export const MARKET_QUESTION = 'Will the US confirm that aliens exist before 2027?';

export const mockPlatformStatus: PlatformStatus = {
  poly: true,
  kalshi: false,
};

export const mockLogEntries: LogEntry[] = [];
