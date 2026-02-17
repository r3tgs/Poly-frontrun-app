import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveBadge } from '../components/LiveBadge';
import { Scoreboard } from '../components/Scoreboard';
import { PlatformToggles } from '../components/PlatformToggles';
import { TeamButtons } from '../components/TeamButtons';
import { ActivityLog } from '../components/ActivityLog';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Colors } from '../constants/colors';
import { mockGame, mockPlatformStatus } from '../mocks/gameData';
import { useBotConnection } from '../hooks/useBotConnection';
import type { LogEntry, PlatformStatus } from '../types';

const DEFAULT_BOT_URL = 'ws://localhost:8080';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const [botUrl, setBotUrl] = useState(DEFAULT_BOT_URL);
  const [platformStatus, setPlatformStatus] =
    useState<PlatformStatus>(mockPlatformStatus);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const addLogEntry = useCallback((entry: LogEntry) => {
    setLogEntries((prev) => [entry, ...prev]);
  }, []);

  const { status, sendSignal } = useBotConnection({
    url: botUrl,
    homeLabel: `${mockGame.homeTeam.city} ${mockGame.homeTeam.name}`,
    awayLabel: `${mockGame.awayTeam.city} ${mockGame.awayTeam.name}`,
    onLogEntry: addLogEntry,
  });

  const handleTogglePlatform = useCallback(
    (platform: 'poly' | 'kalshi') => {
      const newValue = !platformStatus[platform];
      setPlatformStatus((prev) => ({ ...prev, [platform]: newValue }));
    },
    [platformStatus],
  );

  const handleSelectTeam = useCallback(
    (teamId: string) => {
      const isHome = teamId === mockGame.homeTeam.id;
      const team = isHome ? mockGame.homeTeam : mockGame.awayTeam;

      // Local log: "User selected X"
      addLogEntry({
        id: String(Date.now()),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        message: `User selected '${team.city} ${team.name}'`,
        type: 'info',
      });

      // Send buy signal to the bot
      sendSignal(isHome ? 'home' : 'away');
    },
    [addLogEntry, sendSignal],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badges}>
          <LiveBadge />
        </View>
        {/* Big connection banner with IP input */}
        <ConnectionBanner status={status} onUrlChange={setBotUrl} />
        <Scoreboard game={mockGame} />
      </View>

      {/* Bottom card */}
      <View style={styles.card}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.cardContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <PlatformToggles
            status={platformStatus}
            onToggle={handleTogglePlatform}
          />
          <TeamButtons
            homeTeam={mockGame.homeTeam}
            awayTeam={mockGame.awayTeam}
            onSelect={handleSelectTeam}
          />
          <ActivityLog entries={logEntries} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  badges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scrollView: {
    flex: 1,
  },
  cardContent: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
});
