import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { PlatformStatus } from '../types';

interface PlatformTogglesProps {
  status: PlatformStatus;
  onToggle: (platform: 'poly' | 'kalshi') => void;
}

export function PlatformToggles({ status, onToggle }: PlatformTogglesProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.toggle,
          pressed && styles.togglePressed,
        ]}
        onPress={() => onToggle('poly')}
      >
        <Text style={styles.icon}>◆</Text>
        <Text style={styles.label}>Poly: </Text>
        <Text style={status.poly ? styles.statusOn : styles.statusOff}>
          {status.poly ? 'On' : 'Off'}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.toggle,
          pressed && styles.togglePressed,
        ]}
        onPress={() => onToggle('kalshi')}
      >
        <Text style={styles.kalshiIcon}>K</Text>
        <Text style={styles.label}>Kalshi: </Text>
        <Text style={status.kalshi ? styles.statusOn : styles.statusOff}>
          {status.kalshi ? 'On' : 'Off'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  toggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.toggleBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.toggleBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  togglePressed: {
    opacity: 0.7,
  },
  icon: {
    color: Colors.white,
    fontSize: 16,
  },
  kalshiIcon: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  label: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '500',
  },
  statusOn: {
    color: Colors.green,
    fontSize: 15,
    fontWeight: '600',
  },
  statusOff: {
    color: Colors.red,
    fontSize: 15,
    fontWeight: '600',
  },
});
