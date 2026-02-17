import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ConnectionStatus } from '../hooks/useBotConnection';

const statusConfig: Record<ConnectionStatus, { label: string; color: string; bg: string }> = {
  connected: {
    label: 'Bot Connected',
    color: '#34C759',
    bg: 'rgba(52, 199, 89, 0.20)',
  },
  connecting: {
    label: 'Connecting...',
    color: '#FFD60A',
    bg: 'rgba(255, 214, 10, 0.20)',
  },
  disconnected: {
    label: 'Disconnected',
    color: '#FF453A',
    bg: 'rgba(255, 69, 58, 0.20)',
  },
};

interface ConnectionBadgeProps {
  status: ConnectionStatus;
}

export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const config = statusConfig[status];

  return (
    <View style={[styles.container, { borderColor: config.color, backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 12,
    gap: 6,
    borderRadius: 22,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
