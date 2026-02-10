import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import type { Team } from '../types';

interface TeamButtonsProps {
  homeTeam: Team;
  awayTeam: Team;
  onSelect: (teamId: string) => void;
}

const buttonStyles: Record<string, {
  gradientColors: [string, string];
  borderColor: string;
}> = {
  dal: {
    gradientColors: ['#09805A', '#006847'],
    borderColor: '#0DA36F',
  },
  nyr: {
    gradientColors: ['#0D4BC4', '#0038A7'],
    borderColor: '#2967E4',
  },
};

function TeamButton({
  team,
  onPress,
}: {
  team: Team;
  onPress: () => void;
}) {
  const config = buttonStyles[team.id] ?? {
    gradientColors: [team.buttonColor, team.buttonColor] as [string, string],
    borderColor: team.buttonColor,
  };

  return (
    <Pressable
      style={({ pressed }) => [pressed ? styles.buttonPressed : undefined]}
      onPress={onPress}
    >
      {/* Outer ring: box-shadow 0 0 0 2px #101010 */}
      <View style={styles.outerRing}>
        <LinearGradient
          colors={config.gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.button, { borderColor: config.borderColor }]}
        >
          <Text style={styles.buttonText}>
            {team.city} {team.name}
          </Text>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export function TeamButtons({ homeTeam, awayTeam, onSelect }: TeamButtonsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Who scored?</Text>
      <TeamButton team={homeTeam} onPress={() => onSelect(homeTeam.id)} />
      <TeamButton team={awayTeam} onPress={() => onSelect(awayTeam.id)} />
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
  outerRing: {
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 2,
    backgroundColor: '#101010',
  },
  button: {
    paddingVertical: 25,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
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
