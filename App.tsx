import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scoreboard } from './components/Scoreboard';
import { PlatformToggles } from './components/PlatformToggles';
import { TeamButtons } from './components/TeamButtons';
import { ActivityLog } from './components/ActivityLog';
import { ConnectionBanner } from './components/ConnectionBanner';
import { Colors } from './constants/colors';
import { BOT_WS_URL } from './constants/config';
import { mockGame, mockPlatformStatus } from './mocks/gameData';
import { useBotConnection } from './hooks/useBotConnection';
import { MARKET_CONFIG } from './constants/market';
import { togglePlatform } from './api';
import type { LogEntry, PlatformStatus } from './types';

const CARD_PADDING = 20;

function GameScreen() {
  const insets = useSafeAreaInsets();
  const [platformStatus, setPlatformStatus] =
    useState<PlatformStatus>(mockPlatformStatus);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const addLogEntry = useCallback((entry: LogEntry) => {
    setLogEntries((prev) => [entry, ...prev]);
  }, []);

  const { status, sendSignal, sendSell } = useBotConnection({
    url: BOT_WS_URL,
    homeLabel: `${mockGame.homeTeam.city} ${mockGame.homeTeam.name}`,
    awayLabel: `${mockGame.awayTeam.city} ${mockGame.awayTeam.name}`,
    onLogEntry: addLogEntry,
    marketConfig: MARKET_CONFIG,
  });

  const handleTogglePlatform = useCallback(
    (platform: 'poly' | 'kalshi') => {
      const newValue = !platformStatus[platform];
      setPlatformStatus((prev) => ({ ...prev, [platform]: newValue }));
      togglePlatform(platform, newValue);
    },
    [platformStatus]
  );

  const getTimestamp = () =>
    new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const handleSelectTeam = useCallback(
    (teamId: string) => {
      const isHome = teamId === mockGame.homeTeam.id;
      const team = isHome ? mockGame.homeTeam : mockGame.awayTeam;

      addLogEntry({
        id: String(Date.now()),
        timestamp: getTimestamp(),
        message: `User selected '${team.city} ${team.name}'`,
        type: 'info',
      });

      sendSignal(isHome ? 'home' : 'away');
    },
    [addLogEntry, sendSignal]
  );

  const handleSellTeam = useCallback(
    (teamId: string) => {
      const isHome = teamId === mockGame.homeTeam.id;
      const team = isHome ? mockGame.homeTeam : mockGame.awayTeam;

      addLogEntry({
        id: String(Date.now()),
        timestamp: getTimestamp(),
        message: `Sell '${team.city} ${team.name}'`,
        type: 'info',
      });

      sendSell(isHome ? 'home' : 'away', 0);
    },
    [addLogEntry, sendSell]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <ConnectionBanner status={status} url={BOT_WS_URL} />
        <Scoreboard game={mockGame} />
      </View>

      <View style={styles.card}>
        <View style={styles.fixedContent}>
          <PlatformToggles
            status={platformStatus}
            onToggle={handleTogglePlatform}
          />
          <TeamButtons
            homeTeam={mockGame.homeTeam}
            awayTeam={mockGame.awayTeam}
            onSelect={handleSelectTeam}
            onSell={handleSellTeam}
          />
        </View>

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
