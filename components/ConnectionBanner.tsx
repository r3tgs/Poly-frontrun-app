import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ConnectionStatus } from '../hooks/useBotConnection';

interface ConnectionBannerProps {
  status: ConnectionStatus;
  url: string;
}

export function ConnectionBanner({ status, url }: ConnectionBannerProps) {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  // --- Connected: slim green bar ---
  if (isConnected) {
    return (
      <View style={styles.connectedBar}>
        <View style={styles.greenDot} />
        <Text style={styles.connectedText}>Bot Connected</Text>
      </View>
    );
  }

  // --- Disconnected / Connecting ---
  const bannerBg = isConnecting ? '#2a2200' : '#2a0000';
  const accentColor = isConnecting ? '#FFD60A' : '#FF453A';
  const statusLabel = isConnecting ? 'CONNECTING...' : 'NOT CONNECTED';

  let helpText = isConnecting
    ? `Connecting to bot…`
    : `Can't reach the bot server.\nMake sure it's running.`;

  return (
    <View style={[styles.banner, { backgroundColor: bannerBg, borderColor: accentColor }]}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
        <Text style={[styles.statusText, { color: accentColor }]}>{statusLabel}</Text>
      </View>
      <Text style={styles.helpText}>{helpText}</Text>
      <Text style={styles.urlText}>{url}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  connectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },
  connectedText: {
    color: '#34C759',
    fontSize: 15,
    fontWeight: '700',
  },
  banner: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  helpText: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 18,
  },
  urlText: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
