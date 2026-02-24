import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scoreboard } from './components/Scoreboard';
import { PlatformToggles } from './components/PlatformToggles';
import { TeamButtons } from './components/TeamButtons';
import { TradeSize } from './components/TradeSize';
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

  const { status, testMode, activeMarket, defaultTradeSize, sendSignal, sendSell, sendSetTestMode, sendSetDefaultSize } = useBotConnection({
    url: BOT_WS_URL,
    homeLabel: `${mockGame.homeTeam.city} ${mockGame.homeTeam.name}`,
    awayLabel: `${mockGame.awayTeam.city} ${mockGame.awayTeam.name}`,
    onLogEntry: addLogEntry,
    marketConfig: MARKET_CONFIG,
  });

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
        <Scoreboard
          game={{ ...mockGame, homeTeam, awayTeam }}
          homeScore={homeScore}
          awayScore={awayScore}
          onHomeScoreChange={setHomeScore}
          onAwayScoreChange={setAwayScore}
        />
      </View>

      <View style={styles.card}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <PlatformToggles
            status={platformStatus}
            onToggle={handleTogglePlatform}
            testMode={testMode}
            onToggleTestMode={() => sendSetTestMode(!testMode)}
          />
          <TradeSize size={defaultTradeSize} onApply={sendSetDefaultSize} />
          <TeamButtons
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            onSelect={handleSelectTeam}
            onSell={handleSellTeam}
          />
          <View style={styles.logSection}>
            <Text style={styles.logHeading}>Log</Text>
            {logEntries.map((entry) => {
              const color =
                entry.type === 'trade'
                  ? Colors.green
                  : entry.type === 'sell'
                    ? Colors.red
                    : Colors.gray;
              return (
                <Text key={entry.id} style={[styles.logEntry, { color }]}>
                  {entry.timestamp} — {entry.message}
                </Text>
              );
            })}
          </View>
        </ScrollView>
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
  },
  header: {
    paddingVertical: 12,
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderCurve: 'continuous',
  },
  scrollView: {
    flex: 1,
  },
  cardContent: {
    paddingTop: CARD_PADDING,
    paddingHorizontal: CARD_PADDING,
  },
  logSection: {
    marginTop: 8,
  },
  logHeading: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  logEntry: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
});
