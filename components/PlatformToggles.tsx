import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import { PolyIcon } from './icons/PolyIcon';
import { KalshiIcon } from './icons/KalshiIcon';
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
          styles.toggleBase,
          styles.polyToggle,
          pressed ? styles.togglePressed : undefined,
        ]}
        onPress={() => onToggle('poly')}
      >
        <PolyIcon width={16} height={16} color={Colors.white} />
        <Text style={styles.label}>Poly: </Text>
        <Text style={status.poly ? styles.statusOn : styles.statusOff}>
          {status.poly ? 'On' : 'Off'}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.toggleBase,
          styles.kalshiToggle,
          pressed ? styles.togglePressed : undefined,
        ]}
        onPress={() => onToggle('kalshi')}
      >
        <KalshiIcon width={16} height={16} color={Colors.white} />
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
    gap: 10,
    marginBottom: 20,
  },
  toggleBase: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 10,
    gap: 4,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2D2D32',
  },
  polyToggle: {
    backgroundColor: '#000000',
  },
  kalshiToggle: {
    backgroundColor: '#16161A',
  },
  togglePressed: {
    opacity: 0.7,
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
