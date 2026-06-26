/**
 * Thin indeterminate progress bar shown at the top of a list while a background
 * refresh is in flight (Telegram-style): the cached data stays visible underneath
 * and this subtle moving line signals "syncing" without a blocking full-screen
 * spinner.
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Palette } from '@/theme/theme';

export function TopProgressBar({ palette }: { palette: Palette }) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  const segW = Math.max(80, width * 0.4);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-segW, width] });

  return (
    <View style={[styles.track, { backgroundColor: palette.stroke }]} pointerEvents="none">
      <Animated.View
        style={[styles.segment, { width: segW, backgroundColor: palette.accent, transform: [{ translateX }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 2.5, width: '100%', overflow: 'hidden' },
  segment: { height: '100%', borderRadius: 2 },
});
