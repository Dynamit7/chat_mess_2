import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font, gradients, Palette, colors } from '@/theme/theme';

/**
 * Compact Talkify lockup for screen headers: a small glossy teal orb with a "T"
 * glyph + the wordmark. Quiet enough to sit above a large page title without
 * competing with it.
 */
export function BrandMark({ palette = colors }: { palette?: Palette }) {
  const c = palette;
  const orb = 24;
  return (
    <View style={styles.row}>
      <LinearGradient
        colors={gradients.brand as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.orb, { width: orb, height: orb, borderRadius: orb * 0.34, shadowColor: c.brand2 }]}
      >
        {/* glossy highlight */}
        <LinearGradient
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.9 }}
          style={[styles.gloss, { borderTopLeftRadius: orb * 0.34, borderTopRightRadius: orb * 0.34 }]}
        />
        <Text style={[styles.glyph, { fontSize: orb * 0.5 }]}>T</Text>
      </LinearGradient>
      <Text style={[styles.word, { color: c.text }]}>Talkify</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orb: {
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  glyph: { color: '#fff', fontFamily: font.display, marginTop: -1 },
  word: { fontFamily: font.display, fontSize: 17, letterSpacing: 0.2 },
});
