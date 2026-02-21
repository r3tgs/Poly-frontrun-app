import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);

  const addLogEntry = useCallback((entry: LogEntry) => {
    setLogEntries((prev) => [entry, ...prev]);
  }, []);

  const { status, testMode, activeMarket, sendSignal, sendSell, sendSetTestMode } = useBotConnection({
    url: BOT_WS_URL,
    homeLabel: `${mockGame.homeTeam.city} ${mockGame.homeTeam.name}`,
    awayLabel: `${mockGame.awayTeam.city} ${mockGame.awayTeam.name}`,
    onLogEntry: addLogEntry,
    marketConfig: MARKET_CONFIG,
  });

  // Override team names with live market data when available.
  // Fall back to the Kalshi ticker when homeTitle/awayTitle are empty.
  const homeName = activeMarket
    ? (activeMarket.homeTitle || activeMarket.homeKalshiTicker || 'Home')
    : null;
  const awayName = activeMarket
    ? (activeMarket.awayTitle || activeMarket.awayKalshiTicker || 'Away')
    : null;
  const homeTeam = homeName
    ? { ...mockGame.homeTeam, id: 'home', city: '', name: homeName, abbreviation: homeName.slice(0, 4).toUpperCase() }
    : mockGame.homeTeam;
  const awayTeam = awayName
    ? { ...mockGame.awayTeam, id: 'away', city: '', name: awayName, abbreviation: awayName.slice(0, 4).toUpperCase() }
    : mockGame.awayTeam;

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
      const isHome = teamId === 'home' || teamId === mockGame.homeTeam.id;
      const team = isHome ? homeTeam : awayTeam;

      addLogEntry({
        id: String(Date.now()),
        timestamp: getTimestamp(),
        message: `User selected '${team.name}'`,
        type: 'info',
      });

      if (isHome) setHomeScore((s) => s + 1);
      else setAwayScore((s) => s + 1);

      sendSignal(isHome ? 'home' : 'away');
    },
    [addLogEntry, sendSignal, homeTeam, awayTeam]
  );

  const handleSellTeam = useCallback(
    (teamId: string) => {
      const isHome = teamId === 'home' || teamId === mockGame.homeTeam.id;
      const team = isHome ? homeTeam : awayTeam;

      addLogEntry({
        id: String(Date.now()),
        timestamp: getTimestamp(),
        message: `Sell '${team.name}'`,
        type: 'info',
      });

      sendSell(isHome ? 'home' : 'away', 0);
    },
    [addLogEntry, sendSell, homeTeam, awayTeam]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <ConnectionBanner status={status} url={BOT_WS_URL} />
        <View style={styles.marketRow}>
          {activeMarket ? (
            <Text style={styles.marketActive}>
              {activeMarket.description || `${activeMarket.homeKalshiTicker} / ${activeMarket.awayKalshiTicker}`}
              {'\n'}{homeName} vs {awayName}
            </Text>
          ) : (
            <Text style={styles.marketWaiting}>Waiting for market from dashboard…</Text>
          )}
        </View>
        <Scoreboard
          game={{ ...mockGame, homeTeam, awayTeam }}
          homeScore={homeScore}
          awayScore={awayScore}
          onHomeScoreChange={setHomeScore}
          onAwayScoreChange={setAwayScore}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.fixedContent}>
          <PlatformToggles
            status={platformStatus}
            onToggle={handleTogglePlatform}
            testMode={testMode}
            onToggleTestMode={() => sendSetTestMode(!testMode)}
          />
          <TeamButtons
            homeTeam={homeTeam}
            awayTeam={awayTeam}
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
  marketRow: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  marketActive: {
    color: '#4caf50',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  marketWaiting: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
