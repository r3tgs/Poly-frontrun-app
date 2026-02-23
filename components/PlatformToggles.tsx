import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { PolyIcon } from './icons/PolyIcon';
import { KalshiIcon } from './icons/KalshiIcon';
import type { PlatformStatus } from '../types';

interface PlatformTogglesProps {
  status: PlatformStatus;
  onToggle: (platform: 'poly' | 'kalshi') => void;
  testMode?: boolean;
  onToggleTestMode?: () => void;
}

const TOGGLE_COLORS = {
  poly: '#2E5CFF',
  kalshi: '#21C891',
  real: '#4CAF50',
};

const CASING_WIDTH = 47;
const CASING_PADDING = 2;
const THUMB_WIDTH = 24;
const SLIDE_DISTANCE = CASING_WIDTH - CASING_PADDING * 2 - THUMB_WIDTH;

function ToggleSwitch({ enabled, platform }: { enabled: boolean; platform: 'poly' | 'kalshi' | 'real' }) {
  const anim = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: enabled ? 1 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 9,
    }).start();
  }, [enabled, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SLIDE_DISTANCE],
  });

  const casingBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#2D2D32', TOGGLE_COLORS[platform]],
  });

  const thumbBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#606068', '#F0F0F4'],
  });

  return (
    <Animated.View style={[styles.switchCasing, { backgroundColor: casingBg }]}>
      <Animated.View
        style={[
          styles.switchThumb,
          {
            backgroundColor: thumbBg,
            transform: [{ translateX }],
          },
        ]}
      />
    </Animated.View>
  );
}

export function PlatformToggles({ status, onToggle, testMode, onToggleTestMode }: PlatformTogglesProps) {
  // real mode = toggle is ON (testMode = false)
  const realEnabled = testMode === false;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
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

      {onToggleTestMode !== undefined && (
        <View style={styles.row}>
          <Pressable
            style={({ pressed }) => [
              styles.pill,
              realEnabled ? styles.pillEnabled : styles.pillDisabled,
              pressed ? styles.pillPressed : undefined,
            ]}
            onPress={onToggleTestMode}
          >
            <View style={styles.labelRow}>
              <View style={[styles.modeDot, { backgroundColor: realEnabled ? '#4CAF50' : '#868686' }]} />
              <Text style={styles.label}>{realEnabled ? 'Real Mode' : 'Test Mode'}</Text>
            </View>
            <ToggleSwitch enabled={realEnabled} platform="real" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    width: CASING_WIDTH,
    flexDirection: 'row',
    padding: CASING_PADDING,
    alignItems: 'center',
    borderRadius: 20,
  },
  switchThumb: {
    width: THUMB_WIDTH,
    height: 19,
    borderRadius: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
});
