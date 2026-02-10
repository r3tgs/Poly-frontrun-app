import type { GameState, LogEntry, PlatformStatus } from '../types';
import { mockGame, mockLogEntries, mockPlatformStatus } from '../mocks/gameData';

/**
 * Placeholder API functions.
 * Replace these with real API calls when backend is ready.
 */

export async function fetchGameState(): Promise<GameState> {
  // TODO: Replace with real API call
  return mockGame;
}

export async function fetchPlatformStatus(): Promise<PlatformStatus> {
  // TODO: Replace with real API call
  return mockPlatformStatus;
}

export async function fetchLogEntries(): Promise<LogEntry[]> {
  // TODO: Replace with real API call
  return mockLogEntries;
}

export async function selectTeam(teamId: string): Promise<void> {
  // TODO: Replace with real API call
  console.log(`[API] selectTeam: ${teamId}`);
}

export async function togglePlatform(
  platform: 'poly' | 'kalshi',
  enabled: boolean
): Promise<void> {
  // TODO: Replace with real API call
  console.log(`[API] togglePlatform: ${platform} -> ${enabled}`);
}
