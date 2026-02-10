import React, { useCallback, useRef, useState } from 'react';
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
import type { GameState, LogEntry, PlatformStatus } from './types';

const CARD_PADDING = 20;

function GameScreen() {
  const insets = useSafeAreaInsets();
  const [game, setGame] = useState<GameState>(mockGame);
  const [platformStatus, setPlatformStatus] =
    useState<PlatformStatus>(mockPlatformStatus);
  const [logEntries, setLogEntries] = useState<LogEntry[]>(mockLogEntries);
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  const addLog = (message: string, type: LogEntry['type']) => {
    setLogEntries((prev) => [
      { id: String(Date.now() + Math.random()), timestamp: getTimestamp(), message, type },
      ...prev,
    ]);
  };

  const handleSelectTeam = useCallback(
    (teamId: string) => {
      const isHome = teamId === game.homeTeam.id;
      const team = isHome ? game.homeTeam : game.awayTeam;
      const buyPrice = (Math.random() * 0.3 + 0.3).toFixed(2);
      const sellPrice = (parseFloat(buyPrice) + Math.random() * 0.2 + 0.1).toFixed(2);
      const contracts = Math.floor(Math.random() * 150 + 50);

      // Clear any pending timers from previous rapid presses
      pendingTimers.current.forEach(clearTimeout);
      pendingTimers.current = [];

      // Step 1: User selected (immediate)
      addLog(`User selected '${team.city} ${team.name}'`, 'info');
      selectTeam(teamId);

      // Step 2: Sent to bot (~400ms)
      pendingTimers.current.push(
        setTimeout(() => addLog('Sent to bot', 'info'), 400)
      );

      // Step 3: Bought contracts (~1200ms)
      pendingTimers.current.push(
        setTimeout(() => addLog(`Bought ${contracts} contracts @ ${buyPrice}`, 'trade'), 1200)
      );

      // Step 4: Score update (~2000ms) — increment the score
      pendingTimers.current.push(
        setTimeout(() => {
          setGame((prev) => {
            const newHome = isHome ? prev.homeScore + 1 : prev.homeScore;
            const newAway = isHome ? prev.awayScore : prev.awayScore + 1;
            addLog(`Poly updated score to ${newHome}-${newAway}`, 'info');
            return { ...prev, homeScore: newHome, awayScore: newAway };
          });
        }, 2000)
      );

      // Step 5: Sold contracts (~2800ms)
      pendingTimers.current.push(
        setTimeout(() => addLog(`Sold ${contracts} contracts @ ${sellPrice}`, 'sell'), 2800)
      );
    },
    [game]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <LiveBadge />
        <Scoreboard game={game} />
      </View>

      <View style={styles.card}>
        {/* Fixed content: toggles + buttons */}
        <View style={styles.fixedContent}>
          <PlatformToggles
            status={platformStatus}
            onToggle={handleTogglePlatform}
          />
          <TeamButtons
            homeTeam={game.homeTeam}
            awayTeam={game.awayTeam}
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
