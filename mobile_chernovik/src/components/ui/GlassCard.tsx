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
  // Detect light vs dark from the canvas luminance (robust across all themes) —
  // picks the right blur tint + fallback fill so light mode stays crisp.
  const isLight = luminance(palette.bg) > 140;
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

/** Rough perceived brightness (0–255) of a #rrggbb colour. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  fill: { flex: 0 },
  padded: { padding: 18 },
});
