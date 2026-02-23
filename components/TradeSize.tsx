import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const PRESETS = [10, 25, 50, 100];

interface Props {
  size: number;
  onApply: (size: number) => void;
}

export function TradeSize({ size, onApply }: Props) {
  const [customVal, setCustomVal] = useState('');

  const commitCustom = () => {
    const v = parseFloat(customVal);
    if (v > 0) { onApply(v); setCustomVal(''); }
  };

  const isPreset = PRESETS.includes(size);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trade Size</Text>
      <View style={styles.row}>
        {PRESETS.map(p => (
          <Pressable
            key={p}
            style={[styles.preset, size === p && styles.presetActive]}
            onPress={() => onApply(p)}
          >
            <Text style={[styles.presetText, size === p && styles.presetTextActive]}>
              ${p}
            </Text>
          </Pressable>
        ))}
        <View style={[styles.customWrap, !isPreset && styles.customWrapActive]}>
          <Text style={styles.dollar}>$</Text>
          <TextInput
            style={styles.customInput}
            value={customVal}
            onChangeText={setCustomVal}
            keyboardType="decimal-pad"
            placeholder="Custom"
            placeholderTextColor="#555"
            onSubmitEditing={commitCustom}
            onBlur={commitCustom}
            returnKeyType="done"
          />
        </View>
      </View>
      <Text style={styles.current}>
        Default: <Text style={styles.currentVal}>${size}</Text> per trade
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  preset: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    backgroundColor: '#2C2C2E',
  },
  presetActive: {
    borderColor: '#34C759',
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  presetText: {
    color: '#AEAEB2',
    fontSize: 15,
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#34C759',
  },
  customWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    backgroundColor: '#2C2C2E',
    flex: 1,
    minWidth: 80,
  },
  customWrapActive: {
    borderColor: '#34C759',
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  dollar: {
    color: '#AEAEB2',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 2,
  },
  customInput: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    padding: 0,
  },
  current: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 8,
  },
  currentVal: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
