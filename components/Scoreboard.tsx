import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../constants/colors';
import type { GameState } from '../types';

interface ScoreboardProps {
  game: GameState;
  homeScore: number;
  awayScore: number;
  onHomeScoreChange: (score: number) => void;
  onAwayScoreChange: (score: number) => void;
  marketQuestion?: string;
}

function ScoreCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));

  // Keep display text in sync when value changes externally (button press)
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const commit = () => {
    const n = parseInt(text, 10);
    if (!isNaN(n) && n >= 0) onChange(n);
    else setText(String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <TextInput
        style={styles.scoreInput}
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        onBlur={commit}
        onSubmitEditing={commit}
        autoFocus
        maxLength={3}
        selectTextOnFocus
      />
    );
  }

  return (
    <Pressable
      onPress={() => { setText(String(value)); setEditing(true); }}
      hitSlop={12}
    >
      <Text style={styles.score}>{value}</Text>
    </Pressable>
  );
}

export function Scoreboard({ game, homeScore, awayScore, onHomeScoreChange, onAwayScoreChange, marketQuestion }: ScoreboardProps) {
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
        <ScoreCell value={homeScore} onChange={onHomeScoreChange} />
        <Text style={styles.score}>-</Text>
        <ScoreCell value={awayScore} onChange={onAwayScoreChange} />
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
    minWidth: 48,
    textAlign: 'center',
  },
  scoreInput: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.92,
    minWidth: 48,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#4caf50',
    padding: 0,
  },
});
