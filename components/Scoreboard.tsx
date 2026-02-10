import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { GameState } from '../types';

interface ScoreboardProps {
  game: GameState;
}

function TeamLogo({ color, letter }: { color: string; letter: string }) {
  return (
    <View style={[styles.logo, { backgroundColor: color }]}>
      <Text style={styles.logoText}>{letter}</Text>
    </View>
  );
}

export function Scoreboard({ game }: ScoreboardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.teamSection}>
        <TeamLogo color={game.homeTeam.logoColor} letter="★" />
        <Text style={styles.abbreviation}>{game.homeTeam.abbreviation}</Text>
        <Text style={styles.teamName}>{game.homeTeam.name.toUpperCase()}</Text>
      </View>

      <Text style={styles.score}>
        {game.homeScore}  -  {game.awayScore}
      </Text>

      <View style={styles.teamSection}>
        <TeamLogo color={game.awayTeam.logoColor} letter="NYR" />
        <Text style={styles.abbreviation}>{game.awayTeam.abbreviation}</Text>
        <Text style={styles.teamName}>{game.awayTeam.name.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 24,
  },
  teamSection: {
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  abbreviation: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  teamName: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  score: {
    color: Colors.white,
    fontSize: 56,
    fontWeight: '700',
    minWidth: 140,
    textAlign: 'center',
  },
});
