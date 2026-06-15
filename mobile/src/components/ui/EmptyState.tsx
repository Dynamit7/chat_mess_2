import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, gradients, shadow, radius } from '@/theme/theme';

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.glow, shadow.glow]}>
        <Ionicons name={icon} size={40} color={colors.ink} />
      </LinearGradient>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  glow: { width: 88, height: 88, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 22, textAlign: 'center' },
  body: { color: colors.textDim, fontFamily: font.body, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
