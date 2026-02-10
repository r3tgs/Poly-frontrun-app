import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { Team } from '../types';

interface TeamButtonsProps {
  homeTeam: Team;
  awayTeam: Team;
  onSelect: (teamId: string) => void;
}

export function TeamButtons({ homeTeam, awayTeam, onSelect }: TeamButtonsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Who scored?</Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: homeTeam.buttonColor },
          pressed ? styles.buttonPressed : undefined,
        ]}
        onPress={() => onSelect(homeTeam.id)}
      >
        <Text style={styles.buttonText}>
          {homeTeam.city} {homeTeam.name}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: awayTeam.buttonColor },
          pressed ? styles.buttonPressed : undefined,
        ]}
        onPress={() => onSelect(awayTeam.id)}
      >
        <Text style={styles.buttonText}>
          {awayTeam.city} {awayTeam.name}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    marginBottom: 24,
  },
  heading: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 2,
  },
  button: {
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
});
