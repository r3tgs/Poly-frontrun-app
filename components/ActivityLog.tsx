import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { LogEntry } from '../types';

interface ActivityLogProps {
  entries: LogEntry[];
  bottomInset?: number;
}

export function ActivityLog({ entries, bottomInset = 0 }: ActivityLogProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Log</Text>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {entries.map((entry) => {
          const color =
            entry.type === 'trade'
              ? Colors.green
              : entry.type === 'sell'
                ? Colors.red
                : Colors.gray;
          return (
            <Text key={entry.id} style={[styles.entry, { color }]}>
              {entry.timestamp} — {entry.message}
            </Text>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heading: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  scrollView: {
    flex: 1,
  },
  entry: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 6,
  },
});
