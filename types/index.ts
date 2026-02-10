export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  logoColor: string;
  buttonColor: string;
}

export interface GameState {
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  isLive: boolean;
}

export type Platform = 'poly' | 'kalshi';

export interface PlatformStatus {
  poly: boolean;
  kalshi: boolean;
}

export type LogEntryType = 'trade' | 'sell' | 'info';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: LogEntryType;
}
