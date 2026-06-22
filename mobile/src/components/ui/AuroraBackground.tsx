import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { colors, Palette } from '@/theme/theme';

const { width: W, height: H } = Dimensions.get('window');

/**
 * Talkify canvas. A near-black stage lit by two soft indigo blooms — one warm
 * source top-left, a quieter counter-light lower-right — plus a faint top
 * vignette for depth. Premium and atmospheric, never decorative: the blooms are
 * the only colour in the room so the accent always reads against them.
 *
 * Pass `palette` to theme it; defaults to the dark palette so screens not yet
 * migrated to the theme hook keep their look unchanged.
 */
export function AuroraBackground({ children, style, palette = colors }: { children?: ReactNode; style?: ViewStyle; palette?: Palette }) {
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }, style]}>
      {/* Primary bloom anchored top-left — the main light source (per-theme colour). */}
      <LinearGradient
        colors={palette.bloom1}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.7, y: 0.55 }}
        style={[styles.bloom, { width: W * 1.35, height: W * 1.35, left: -W * 0.4, top: -W * 0.55 }]}
        pointerEvents="none"
      />
      {/* Deeper counter-light, lower-right, for quiet dimension. */}
      <LinearGradient
        colors={palette.bloom2}
        start={{ x: 0.95, y: 0.35 }}
        end={{ x: 0.35, y: 1 }}
        style={[styles.bloom, { width: W * 1.1, height: W * 1.1, right: -W * 0.35, top: H * 0.46 }]}
        pointerEvents="none"
      />
      {/* Faint accent wash centre-right to keep the midground from going flat. */}
      <LinearGradient
        colors={palette.bloom3}
        start={{ x: 1, y: 0.25 }}
        end={{ x: 0.4, y: 0.6 }}
        style={[styles.bloom, { width: W * 0.9, height: W * 0.9, right: -W * 0.25, top: H * 0.12 }]}
        pointerEvents="none"
      />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  bloom: { position: 'absolute', borderRadius: 9999 },
  content: { flex: 1 },
});
