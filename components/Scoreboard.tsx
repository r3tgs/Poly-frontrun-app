import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { GameState } from '../types';

interface ScoreboardProps {
  game: GameState;
  marketQuestion?: string;
}

export function Scoreboard({ game, marketQuestion }: ScoreboardProps) {
  if (marketQuestion) {
    return (
      <View style={styles.container}>
        <Text style={styles.marketQuestion}>{marketQuestion}</Text>
      </View>
    );
  }

  return (
    <View style={styles.scoreboardRow}>
      <View style={styles.teamSection}>
        <Text style={styles.abbreviation}>{game.homeTeam.abbreviation}</Text>
        <Text style={styles.teamName}>{game.homeTeam.name.toUpperCase()}</Text>
      </View>

      <View style={styles.scoreContainer}>
        <Text style={styles.score}>{game.homeScore}</Text>
        <Text style={styles.score}>-</Text>
        <Text style={styles.score}>{game.awayScore}</Text>
      </View>

      <View style={styles.teamSection}>
        <Text style={styles.abbreviation}>{game.awayTeam.abbreviation}</Text>
        <Text style={styles.teamName}>{game.awayTeam.name.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  marketQuestion: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 30,
  },
  scoreboardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 20,
  },
  teamSection: {
    alignItems: 'center',
    gap: 2,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  abbreviation: {
    color: '#868686',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 14,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  score: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.92,
  },
});
