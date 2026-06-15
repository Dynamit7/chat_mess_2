import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

/**
 * Premium DeFensy wordmark.
 * Orbitron type, wide tracking, animated dual violet+cyan glow, accent dot.
 * No native deps — the gradient feel comes from two stacked glow layers.
 */
export default function DefensyLogo({ size = 34, animated = true, style }) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2200, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 2200, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, glow]);

  const radius = animated
    ? glow.interpolate({ inputRange: [0, 1], outputRange: [8, 22] })
    : 14;

  const letterSpacing = size * 0.14;

  const base = [
    styles.word,
    {
      fontSize: size,
      letterSpacing,
      lineHeight: size * 1.18,
    },
  ];

  return (
    <View style={[styles.row, style]}>
      <View>
        {/* Violet glow layer (behind) */}
        <Animated.Text
          style={[
            base,
            styles.absolute,
            { textShadowColor: 'rgba(124, 92, 255, 0.95)', textShadowRadius: radius },
          ]}
        >
          DeFensy
        </Animated.Text>
        {/* Cyan glow layer (front) */}
        <Animated.Text
          style={[
            base,
            { textShadowColor: 'rgba(0, 194, 255, 0.85)', textShadowRadius: radius },
          ]}
        >
          DeFensy
        </Animated.Text>
      </View>
      <View style={[styles.dot, { width: size * 0.16, height: size * 0.16, borderRadius: size * 0.16, marginBottom: size * 0.12 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  word: {
    fontFamily: 'Orbitron_700Bold',
    color: '#FFFFFF',
    textShadowOffset: { width: 0, height: 0 },
  },
  absolute: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  dot: {
    backgroundColor: '#00C2FF',
    marginLeft: 6,
    shadowColor: '#00C2FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
});
