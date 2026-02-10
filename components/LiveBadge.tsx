import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FireIcon } from './icons/FireIcon';

export function LiveBadge() {
  return (
    <View style={styles.container}>
      <FireIcon width={14} height={18} />
      <Text style={styles.text}>Live</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 10,
    gap: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FF7A00',
    backgroundColor: 'rgba(255, 122, 0, 0.26)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
