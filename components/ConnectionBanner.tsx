import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConnectionStatus } from '../hooks/useBotConnection';

const STORAGE_KEY = 'bot_ip';
const DEFAULT_PORT = '8080';

interface ConnectionBannerProps {
  status: ConnectionStatus;
  onUrlChange: (url: string) => void;
}

export function ConnectionBanner({ status, onUrlChange }: ConnectionBannerProps) {
  const [ip, setIp] = useState('');
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load persisted IP on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setIp(stored);
        onUrlChange(`ws://${stored}:${DEFAULT_PORT}`);
      }
      setLoaded(true);
    });
  }, []);

  const handleConnect = () => {
    const trimmed = ip.trim();
    if (!trimmed) return;
    AsyncStorage.setItem(STORAGE_KEY, trimmed);
    onUrlChange(`ws://${trimmed}:${DEFAULT_PORT}`);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  // --- Connected: slim green bar ---
  if (isConnected) {
    return (
      <View style={styles.connectedBar}>
        <View style={styles.greenDot} />
        <Text style={styles.connectedText}>Bot Connected</Text>
        <Text style={styles.connectedIp}>{ip || 'localhost'}</Text>
      </View>
    );
  }

  // --- Disconnected / Connecting: big red/yellow banner with IP input ---
  const bannerBg = isConnecting ? '#2a2200' : '#2a0000';
  const accentColor = isConnecting ? '#FFD60A' : '#FF453A';
  const statusLabel = isConnecting ? 'CONNECTING...' : 'NOT CONNECTED';
  const hasIp = ip.trim().length > 0;

  return (
    <View style={[styles.banner, { backgroundColor: bannerBg, borderColor: accentColor }]}>
      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
        <Text style={[styles.statusText, { color: accentColor }]}>{statusLabel}</Text>
      </View>

      {/* Instructions */}
      {!isConnecting && loaded && !hasIp && (
        <Text style={styles.helpText}>
          Enter your computer's IP to connect the bot.{'\n'}
          Run: ipconfig (Win) / ipconfig getifaddr en0 (Mac)
        </Text>
      )}
      {!isConnecting && loaded && hasIp && (
        <Text style={styles.helpText}>
          Can't reach {ip}:{DEFAULT_PORT} — is the bot running?{'\n'}
          Run: cd bot-backend && npm start
        </Text>
      )}

      {/* IP input row */}
      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>IP:</Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder="192.168.1.42"
          placeholderTextColor="#666"
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleConnect}
        />
        <TouchableOpacity
          style={[styles.connectBtn, saved && styles.connectBtnSaved]}
          onPress={handleConnect}
        >
          <Text style={styles.connectBtnText}>{saved ? 'Saved!' : 'Connect'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- Connected state ----
  connectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },
  connectedText: {
    color: '#34C759',
    fontSize: 15,
    fontWeight: '700',
  },
  connectedIp: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.7,
  },

  // ---- Disconnected / Connecting state ----
  banner: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  helpText: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabel: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'monospace',
  },
  connectBtn: {
    backgroundColor: '#0A84FF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  connectBtnSaved: {
    backgroundColor: '#34C759',
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
