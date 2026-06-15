import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { colors, font, radius } from '@/theme/theme';

type Action = { icon: keyof typeof Ionicons.glyphMap; onPress: () => void };

/** Large gradient-friendly screen header with optional trailing actions. */
export function ScreenHeader({
  title,
  subtitle,
  actions,
  left,
}: {
  title: string;
  subtitle?: string;
  actions?: Action[];
  left?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={styles.row}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {left}
          <View style={{ flex: 1 }}>
            {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {actions?.map((a, i) => (
            <Pressable key={i} onPress={a.onPress} style={styles.actionBtn} hitSlop={8}>
              <Ionicons name={a.icon} size={20} color={colors.text} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 32, letterSpacing: -0.4 },
  subtitle: { color: colors.accent, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: colors.glass2, borderWidth: 1, borderColor: colors.stroke,
    alignItems: 'center', justifyContent: 'center',
  },
});
