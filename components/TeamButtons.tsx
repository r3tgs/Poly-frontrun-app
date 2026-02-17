import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/colors';
import type { Team } from '../types';

interface TeamButtonsProps {
  homeTeam: Team;
  awayTeam: Team;
  onSelect: (teamId: string) => void;
  onSell: (teamId: string) => void;
}

const buyStyles: Record<string, {
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

function BuyButton({
  team,
  onPress,
}: {
  team: Team;
  onPress: () => void;
}) {
  const config = buyStyles[team.id] ?? {
    gradientColors: [team.buttonColor, team.buttonColor] as [string, string],
    borderColor: team.buttonColor,
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.buyPressable, pressed ? styles.buttonPressed : undefined]}
      onPress={onPress}
    >
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

function SellButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [pressed ? styles.buttonPressed : undefined]}
      onPress={onPress}
    >
      <View style={styles.outerRing}>
        <LinearGradient
          colors={['#F63658', '#B71431']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.button, styles.sellButton]}
        >
          <Text style={styles.sellText}>Sell</Text>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export function TeamButtons({ homeTeam, awayTeam, onSelect, onSell }: TeamButtonsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Who scored?</Text>
      <View style={styles.row}>
        <BuyButton team={homeTeam} onPress={() => onSelect(homeTeam.id)} />
        <SellButton onPress={() => onSell(homeTeam.id)} />
      </View>
      <View style={styles.row}>
        <BuyButton team={awayTeam} onPress={() => onSelect(awayTeam.id)} />
        <SellButton onPress={() => onSell(awayTeam.id)} />
      </View>
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
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  buyPressable: {
    flex: 1,
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
  sellButton: {
    borderColor: '#FF637F',
    paddingHorizontal: 20,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  sellText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
});
