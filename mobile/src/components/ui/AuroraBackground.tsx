import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { colors, Palette } from '@/theme/theme';

const { width: W, height: H } = Dimensions.get('window');

/**
 * Rossi canvas. A midnight-purple stage lit by a single violet bloom in
 * the top-left — premium and minimal, never decorative.
 *
 * Pass `palette` to theme it; defaults to the dark palette so screens not yet
 * migrated to the theme hook keep their look unchanged.
 */
export function AuroraBackground({ children, style, palette = colors }: { children?: ReactNode; style?: ViewStyle; palette?: Palette }) {
  return (
    <View style={[styles.root, { backgroundColor: palette.bg }, style]}>
      {/* Violet glow anchored top-left — the one source of colour on midnight. */}
      <LinearGradient
        colors={['rgba(124,77,255,0.20)', 'rgba(124,77,255,0)']}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.65, y: 0.5 }}
        style={[styles.bloom, { width: W * 1.25, height: W * 1.25, left: -W * 0.35, top: -W * 0.5 }]}
        pointerEvents="none"
      />
      {/* A whisper of deep violet counter-light, lower right, for quiet dimension. */}
      <LinearGradient
        colors={['rgba(92,48,224,0.08)', 'rgba(92,48,224,0)']}
        start={{ x: 0.9, y: 0.4 }}
        end={{ x: 0.4, y: 1 }}
        style={[styles.bloom, { width: W, height: W, right: -W * 0.3, top: H * 0.5 }]}
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
