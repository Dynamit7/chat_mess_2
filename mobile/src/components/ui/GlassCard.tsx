import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { colors, radius, Palette } from '@/theme/theme';

/**
 * Frosted glass surface. Uses a real blur on iOS/Android; falls back to a
 * translucent fill where blur is unavailable.
 *
 * Pass `palette` to theme it; defaults to the dark palette so screens not yet
 * migrated keep their look unchanged.
 */
export function GlassCard({
  children,
  style,
  intensity = 30,
  padded = true,
  palette = colors,
}: {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  padded?: boolean;
  palette?: Palette;
}) {
  // Light palette text is black — use it to pick the blur tint + fallback fill.
  const isLight = palette.text === '#000000';
  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: palette.stroke,
          backgroundColor: Platform.OS === 'android'
            ? (isLight ? 'rgba(255,255,255,0.92)' : 'rgba(28,28,30,0.92)')
            : (isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.05)'),
        },
        style,
      ]}
    >
      <BlurView intensity={intensity} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
      <View style={[styles.fill, padded && styles.padded]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  fill: { flex: 0 },
  padded: { padding: 18 },
});
