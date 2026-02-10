import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { GameState } from '../types';

interface ScoreboardProps {
  game: GameState;
}

const logos: Record<string, { source: ImageSourcePropType; bg: string; glow: string }> = {
  dal: {
    source: require('../assets/Stars logo.png'),
    bg: '#006847',
    glow: 'rgba(0, 104, 71, 0.30)',
  },
  nyr: {
    source: require('../assets/Rangers logo.png'),
    bg: '#0038A7',
    glow: 'rgba(0, 56, 167, 0.30)',
  },
};

function TeamLogo({ teamId }: { teamId: string }) {
  const logo = logos[teamId];
  if (!logo) return null;

  return (
    <View style={[styles.logoGlow, { backgroundColor: logo.glow }]}>
      <View style={[styles.logoBorder, { backgroundColor: logo.bg }]}>
        <Image source={logo.source} style={styles.logoImage} resizeMode="contain" />
      </View>
    </View>
  );
}

export function Scoreboard({ game }: ScoreboardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.teamSection}>
        <TeamLogo teamId={game.homeTeam.id} />
        <Text style={styles.abbreviation}>{game.homeTeam.abbreviation}</Text>
        <Text style={styles.teamName}>{game.homeTeam.name.toUpperCase()}</Text>
      </View>

      <Text style={styles.score}>
        {game.homeScore}  -  {game.awayScore}
      </Text>

      <View style={styles.teamSection}>
        <TeamLogo teamId={game.awayTeam.id} />
        <Text style={styles.abbreviation}>{game.awayTeam.abbreviation}</Text>
        <Text style={styles.teamName}>{game.awayTeam.name.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const LOGO_SIZE = 72;

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
  logoGlow: {
    borderRadius: 50,
    padding: 2,
  },
  logoBorder: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: LOGO_SIZE - 6,
    height: LOGO_SIZE - 6,
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
