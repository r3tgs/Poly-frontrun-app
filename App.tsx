import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveBadge } from './components/LiveBadge';
import { Scoreboard } from './components/Scoreboard';
import { PlatformToggles } from './components/PlatformToggles';
import { TeamButtons } from './components/TeamButtons';
import { ActivityLog } from './components/ActivityLog';
import { Colors } from './constants/colors';
import { mockGame, mockLogEntries, mockPlatformStatus } from './mocks/gameData';
import { selectTeam, togglePlatform } from './api';
import type { LogEntry, PlatformStatus } from './types';

const CARD_PADDING = 20;

function GameScreen() {
  const insets = useSafeAreaInsets();
  const [platformStatus, setPlatformStatus] =
    useState<PlatformStatus>(mockPlatformStatus);
  const [logEntries, setLogEntries] = useState<LogEntry[]>(mockLogEntries);

  const handleTogglePlatform = useCallback(
    (platform: 'poly' | 'kalshi') => {
      const newValue = !platformStatus[platform];
      setPlatformStatus((prev) => ({ ...prev, [platform]: newValue }));
      togglePlatform(platform, newValue);
    },
    [platformStatus]
  );

  const handleSelectTeam = useCallback(
    (teamId: string) => {
      const team =
        teamId === mockGame.homeTeam.id
          ? mockGame.homeTeam
          : mockGame.awayTeam;

      const newEntry: LogEntry = {
        id: String(Date.now()),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        message: `User selected '${team.city} ${team.name}'`,
        type: 'info',
      };

      setLogEntries((prev) => [newEntry, ...prev]);
      selectTeam(teamId);
    },
    []
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <LiveBadge />
        <Scoreboard game={mockGame} />
      </View>

      <View style={styles.card}>
        {/* Fixed content: toggles + buttons */}
        <View style={styles.fixedContent}>
          <PlatformToggles
            status={platformStatus}
            onToggle={handleTogglePlatform}
          />
          <TeamButtons
            homeTeam={mockGame.homeTeam}
            awayTeam={mockGame.awayTeam}
            onSelect={handleSelectTeam}
          />
        </View>

        {/* Only the log scrolls */}
        <ActivityLog
          entries={logEntries}
          bottomInset={insets.bottom}
        />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GameScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'flex-end',
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  card: {
    height: 530,
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderCurve: 'continuous',
  },
  fixedContent: {
    paddingTop: CARD_PADDING,
    paddingHorizontal: CARD_PADDING,
  },
});
