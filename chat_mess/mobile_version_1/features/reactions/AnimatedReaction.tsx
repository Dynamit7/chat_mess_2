/**
 * AnimatedReaction Component
 * Floating animated emoji that rises and fades out
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

interface AnimatedReactionProps {
  emoji: string;
  startPosition: { x: number; y: number };
  onComplete: () => void;
  size?: number;
  duration?: number;
}

export const AnimatedReaction: React.FC<AnimatedReactionProps> = ({
  emoji,
  startPosition,
  onComplete,
  size = 32,
  duration = 2000,
}) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Pop in animation
    scale.value = withSequence(
      withSpring(1.5, { damping: 8, stiffness: 500 }),
      withSpring(1, { damping: 12, stiffness: 300 })
    );

    // Float up with wobble
    translateY.value = withDelay(
      200,
      withTiming(-180, {
        duration: duration - 200,
        easing: Easing.out(Easing.cubic),
      })
    );

    // Random horizontal drift
    const drift = (Math.random() - 0.5) * 80;
    translateX.value = withDelay(
      200,
      withSpring(drift, { damping: 15, stiffness: 60 })
    );

    // Gentle rotation
    const rotationAmount = (Math.random() - 0.5) * 30;
    rotation.value = withDelay(
      200,
      withSpring(rotationAmount, { damping: 10, stiffness: 40 })
    );

    // Fade out
    opacity.value = withDelay(
      duration - 400,
      withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: startPosition.x + translateX.value },
        { translateY: startPosition.y + translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}deg` },
      ] as const,
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={[styles.emoji, { fontSize: size }]}>{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  emoji: {
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

export default AnimatedReaction;
