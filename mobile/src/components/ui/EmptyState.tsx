import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, gradients, shadow, radius, Palette } from '@/theme/theme';

export function EmptyState({
  icon,
  title,
  body,
  palette = colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  palette?: Palette;
}) {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.glow, shadow.glow]}>
        <Ionicons name={icon} size={40} color={palette.ink} />
      </LinearGradient>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: palette.textDim }]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  glow: { width: 88, height: 88, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
