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
    borderColor: '#005839',
  },
  nyr: {
    gradientColors: ['#0D4BC4', '#0038A7'],
    borderColor: '#001E58',
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
      <LinearGradient
        colors={config.gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.button, { borderColor: config.borderColor }]}
      >
        {/* Stacked layers to simulate blurred inset glow */}
        <View style={styles.glow1} />
        <View style={styles.glow2} />
        <View style={styles.glow3} />
        <View style={styles.glow4} />
        <View style={styles.glow5} />
        <Text style={styles.buttonText}>
          {team.city} {team.name}
        </Text>
      </LinearGradient>
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
  button: {
    paddingVertical: 25,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow1: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.40)',
  },
  glow2: {
    position: 'absolute',
    top: 1.5,
    left: 1.5,
    right: 1.5,
    bottom: 1.5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  glow3: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  glow4: {
    position: 'absolute',
    top: 4.5,
    left: 4.5,
    right: 4.5,
    bottom: 4.5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  glow5: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.03)',
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
