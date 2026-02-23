import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveBadge } from '../components/LiveBadge';
import { Scoreboard } from '../components/Scoreboard';
import { PlatformToggles } from '../components/PlatformToggles';
import { TeamButtons } from '../components/TeamButtons';
import { TradeSize } from '../components/TradeSize';
import { ActivityLog } from '../components/ActivityLog';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Colors } from '../constants/colors';
import { mockGame, mockPlatformStatus } from '../mocks/gameData';
import { MARKET_CONFIG } from '../constants/market';
import { useBotConnection } from '../hooks/useBotConnection';
import type { LogEntry, PlatformStatus } from '../types';

const DEFAULT_BOT_URL = 'wss://pm-frontrun-snowy-waterfall-1028.fly.dev';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const [botUrl, setBotUrl] = useState(DEFAULT_BOT_URL);
  const [platformStatus, setPlatformStatus] =
    useState<PlatformStatus>(mockPlatformStatus);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const addLogEntry = useCallback((entry: LogEntry) => {
    setLogEntries((prev) => [entry, ...prev]);
  }, []);

  const { status, activeMarket, defaultTradeSize, sendSignal, sendSell, sendSetDefaultSize } = useBotConnection({
    url: botUrl,
    homeLabel: mockGame.homeTeam.name,
    awayLabel: mockGame.awayTeam.name,
    onLogEntry: addLogEntry,
    marketConfig: MARKET_CONFIG,
  });

  // Override team names with live market data when available
  const homeTeam = activeMarket?.homeTitle
    ? { ...mockGame.homeTeam, name: activeMarket.homeTitle, abbreviation: activeMarket.homeTitle.slice(0, 4).toUpperCase() }
    : mockGame.homeTeam;
  const awayTeam = activeMarket?.awayTitle
    ? { ...mockGame.awayTeam, name: activeMarket.awayTitle, abbreviation: activeMarket.awayTitle.slice(0, 4).toUpperCase() }
    : mockGame.awayTeam;
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
      const team = isHome ? homeTeam : awayTeam;

      // Local log: "User selected X"
      addLogEntry({
        id: String(Date.now()),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        message: `User selected '${team.name}'`,
        type: 'info',
      });

      // Send buy signal to the bot
      sendSignal(isHome ? 'home' : 'away');
    },
    [addLogEntry, sendSignal, homeTeam, awayTeam],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badges}>
          <LiveBadge />
        </View>
        {/* Big connection banner with IP input */}
        <ConnectionBanner status={status} url={botUrl} />
        <Scoreboard game={{ ...mockGame, homeTeam, awayTeam }} />
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
          <TradeSize size={defaultTradeSize} onApply={sendSetDefaultSize} />
          <TeamButtons
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            onSelect={handleSelectTeam}
            onSell={(teamId) => {
              const isHome = teamId === mockGame.homeTeam.id;
              sendSell(isHome ? 'home' : 'away', 0);
            }}
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

