import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { colors, avatarGradient, initials, font } from '@/theme/theme';
import { fixFileUrl } from '@/lib/config';

type Props = {
  name?: string;
  src?: string | null;
  size?: number;
  online?: boolean;
  ring?: boolean;
};

/** Circular avatar: image when present, otherwise a deterministic gradient + initials. */
export function Avatar({ name, src, size = 48, online, ring }: Props) {
  const grad = avatarGradient(name || 'x');
  const url = src ? fixFileUrl(src) : '';
  const dot = Math.max(10, size * 0.26);

  const inner = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : (
        <LinearGradient colors={grad} style={styles.fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
        </LinearGradient>
      )}
    </View>
  );

  return (
    <View style={{ width: size, height: size }}>
      {ring ? (
        <LinearGradient
          colors={[colors.brand1, colors.brand3]}
          style={{ width: size, height: size, borderRadius: size / 2, padding: 2.5 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.bg }}>{inner}</View>
        </LinearGradient>
      ) : (
        inner
      )}
      {online && (
        <View
          style={[
            styles.dot,
            { width: dot, height: dot, borderRadius: dot / 2, right: 0, bottom: 0, borderWidth: Math.max(2, size * 0.045) },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontFamily: font.bodyBold, letterSpacing: 0.5 },
  dot: { position: 'absolute', backgroundColor: colors.online, borderColor: colors.bg },
});
