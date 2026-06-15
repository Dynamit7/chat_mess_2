import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { colors, radius } from '@/theme/theme';

/**
 * Frosted glass surface. Uses a real blur on iOS/Android; falls back to a
 * translucent fill where blur is unavailable.
 */
export function GlassCard({
  children,
  style,
  intensity = 30,
  padded = true,
}: {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  padded?: boolean;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.fill, padded && styles.padded]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: Platform.OS === 'android' ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.05)',
  },
  fill: { flex: 0 },
  padded: { padding: 18 },
});
