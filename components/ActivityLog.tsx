import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { LogEntry } from '../types';

interface ActivityLogProps {
  entries: LogEntry[];
}

export function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Log</Text>
      {entries.map((entry) => {
        const color = entry.type === 'trade' ? Colors.green : Colors.gray;
        return (
          <Text key={entry.id} style={[styles.entry, { color }]}>
            {entry.timestamp} — {entry.message}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  heading: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  entry: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
});
