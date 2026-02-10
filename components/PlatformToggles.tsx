import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PolyIcon } from './icons/PolyIcon';
import { KalshiIcon } from './icons/KalshiIcon';
import type { PlatformStatus } from '../types';

interface PlatformTogglesProps {
  status: PlatformStatus;
  onToggle: (platform: 'poly' | 'kalshi') => void;
}

const TOGGLE_COLORS = {
  poly: '#2E5CFF',
  kalshi: '#21C891',
};

function ToggleSwitch({ enabled, platform }: { enabled: boolean; platform: 'poly' | 'kalshi' }) {
  return (
    <View
      style={[
        styles.switchCasing,
        enabled
          ? { backgroundColor: TOGGLE_COLORS[platform], justifyContent: 'flex-end' }
          : styles.switchCasingDisabled,
      ]}
    >
      <LinearGradient
        colors={enabled ? ['#FFFFFF', '#D9D9E4'] : ['#787881', '#52525B']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.switchThumb}
      />
    </View>
  );
}

export function PlatformToggles({ status, onToggle }: PlatformTogglesProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.pill,
          status.poly ? styles.pillEnabled : styles.pillDisabled,
          pressed ? styles.pillPressed : undefined,
        ]}
        onPress={() => onToggle('poly')}
      >
        <View style={styles.labelRow}>
          <PolyIcon width={16} height={16} color={status.poly ? '#2E5CFF' : '#868686'} />
          <Text style={styles.label}>Poly</Text>
        </View>
        <ToggleSwitch enabled={status.poly} platform="poly" />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.pill,
          status.kalshi ? styles.pillEnabled : styles.pillDisabled,
          pressed ? styles.pillPressed : undefined,
        ]}
        onPress={() => onToggle('kalshi')}
      >
        <View style={styles.labelRow}>
          <KalshiIcon width={16} height={16} color={status.kalshi ? '#21C891' : '#868686'} />
          <Text style={styles.label}>Kalshi</Text>
        </View>
        <ToggleSwitch enabled={status.kalshi} platform="kalshi" />
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
  pill: {
    flex: 1,
    flexDirection: 'row',
    height: 41,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 9,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2D2D32',
  },
  pillEnabled: {
    backgroundColor: '#000000',
  },
  pillDisabled: {
    backgroundColor: '#16161A',
  },
  pillPressed: {
    opacity: 0.7,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  switchCasing: {
    width: 47,
    flexDirection: 'row',
    padding: 2,
    alignItems: 'center',
    borderRadius: 20,
  },
  switchCasingDisabled: {
    backgroundColor: '#2D2D32',
    justifyContent: 'flex-start',
  },
  switchThumb: {
    width: 24,
    height: 19,
    borderRadius: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
});
