import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font, gradients, colors } from '@/theme/theme';

/** Brand lockup: a glowing teal orb + the Talkify wordmark. */
export function Logo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const orb = size === 'lg' ? 60 : 40;
  return (
    <View style={styles.row}>
      <View style={{ width: orb, height: orb }}>
        {/* outer glow halo */}
        <LinearGradient
          colors={['rgba(22,194,168,0.6)', 'rgba(22,194,168,0.0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.halo, { width: orb * 1.7, height: orb * 1.7, borderRadius: orb, left: -orb * 0.35, top: -orb * 0.35 }]}
        />
        {/* core orb */}
        <LinearGradient
          colors={gradients.brand as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.orb, { width: orb, height: orb, borderRadius: orb * 0.34 }]}
        >
          {/* glossy highlight */}
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 0.9 }}
            style={[styles.gloss, { borderTopLeftRadius: orb * 0.34, borderTopRightRadius: orb * 0.34 }]}
          />
          <Text style={[styles.glyph, { fontSize: orb * 0.46 }]}>T</Text>
        </LinearGradient>
      </View>
      {size === 'lg' && (
        <View>
          <Text style={styles.word}>Talkify</Text>
          <Text style={styles.tag}>MESSENGER</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  halo: { position: 'absolute' },
  orb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  glyph: { color: '#fff', fontFamily: font.display },
  word: { color: colors.text, fontFamily: font.display, fontSize: 26, letterSpacing: 0.3 },
  tag: { color: colors.textFaint, fontFamily: font.bodySemi, fontSize: 9, letterSpacing: 4, marginTop: -2 },
});
