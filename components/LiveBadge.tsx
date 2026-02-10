import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { FireIcon } from './icons/FireIcon';

export function LiveBadge() {
  const flicker = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.8, duration: 250, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.1, duration: 350, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.9, duration: 200, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [flicker]);

  const scale = flicker.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.12, 1.05],
  });

  const opacity = flicker.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0.85, 1, 0.9, 1],
  });

  const rotate = flicker.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['-2deg', '3deg', '-1deg', '2deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale }, { rotate }], opacity }}>
        <FireIcon width={14} height={18} />
      </Animated.View>
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
    color: '#FF7A00',
    fontSize: 16,
    fontWeight: '600',
  },
});
