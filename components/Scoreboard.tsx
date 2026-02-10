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
      {/* Home team column */}
      <View style={styles.teamSection}>
        <TeamLogo teamId={game.homeTeam.id} />
        <Text style={styles.abbreviation}>{game.homeTeam.abbreviation}</Text>
        <Text style={styles.teamName}>{game.homeTeam.name.toUpperCase()}</Text>
      </View>

      {/* Score */}
      <View style={styles.scoreContainer}>
        <Text style={styles.score}>{game.homeScore}</Text>
        <Text style={styles.score}>-</Text>
        <Text style={styles.score}>{game.awayScore}</Text>
      </View>

      {/* Away team column */}
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
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 20,
  },
  teamSection: {
    alignItems: 'center',
    gap: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: LOGO_SIZE + 4, // match logo glow height (logo + 2px padding each side)
    gap: 14,
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
    color: '#868686',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
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
