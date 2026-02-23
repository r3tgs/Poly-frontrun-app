import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bot_ws_url';
const DEFAULT_PORT = '8080';

interface BotUrlBarProps {
  /** Called with the full ws:// URL whenever the user saves. */
  onUrlChange: (url: string) => void;
}

export function BotUrlBar({ onUrlChange }: BotUrlBarProps) {
  const [ip, setIp] = useState('');
  const [saved, setSaved] = useState(false);

  // Load persisted IP on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setIp(stored);
        onUrlChange(`ws://${stored}:${DEFAULT_PORT}`);
      }
    });
  }, []);

  const handleSave = () => {
    const trimmed = ip.trim();
    if (!trimmed) return;
    AsyncStorage.setItem(STORAGE_KEY, trimmed);
    onUrlChange(`ws://${trimmed}:${DEFAULT_PORT}`);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Bot IP</Text>
      <TextInput
        style={styles.input}
        value={ip}
        onChangeText={setIp}
        placeholder="192.168.x.x"
        placeholderTextColor="#666"
        keyboardType="numeric"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
      <TouchableOpacity
        style={[styles.button, saved && styles.buttonSaved]}
        onPress={handleSave}
      >
        <Text style={styles.buttonText}>{saved ? 'Saved' : 'Connect'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#0A84FF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  buttonSaved: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
