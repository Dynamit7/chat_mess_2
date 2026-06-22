import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/theme';

const THRESHOLD = 60; // px the bubble must travel right to fire a reply
const MAX = 84;

const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/**
 * Telegram-style swipe-to-reply. Drag a message a little to the right; once it
 * passes the threshold a reply arrow lights up and releasing fires `onReply`.
 * Horizontal-only activation keeps the vertical FlatList scroll untouched.
 */
export function SwipeToReply({
  children,
  onReply,
  enabled = true,
  alignRight = false,
}: {
  children: ReactNode;
  onReply: () => void;
  enabled?: boolean;
  alignRight?: boolean;
}) {
  const tx = useSharedValue(0);
  const armed = useSharedValue(false);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(14)        // only claim the gesture on a rightward drag
    .failOffsetY([-12, 12])   // let vertical scrolling win
    .onUpdate((e) => {
      const x = Math.max(0, Math.min(e.translationX, MAX));
      tx.value = x;
      if (x >= THRESHOLD && !armed.value) { armed.value = true; runOnJS(tick)(); }
      else if (x < THRESHOLD && armed.value) { armed.value = false; }
    })
    .onEnd(() => {
      if (armed.value) runOnJS(onReply)();
      tx.value = withSpring(0, { damping: 18, stiffness: 220 });
      armed.value = false;
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [10, THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(tx.value, [10, THRESHOLD], [0.4, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <Animated.View>
      <Animated.View style={[styles.icon, alignRight ? styles.iconRight : styles.iconLeft, iconStyle]} pointerEvents="none">
        <Ionicons name="arrow-undo" size={18} color={colors.accent} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute', top: 0, bottom: 0, width: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  iconLeft: { left: 6 },
  iconRight: { left: 6 },
});
