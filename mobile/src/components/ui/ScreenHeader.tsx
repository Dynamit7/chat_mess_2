import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { colors, font, radius, Palette } from '@/theme/theme';
import { BrandMark } from '@/components/ui/BrandMark';

type Action = { icon: keyof typeof Ionicons.glyphMap; onPress: () => void };

/** Large gradient-friendly screen header with optional trailing actions. */
export function ScreenHeader({
  title,
  subtitle,
  actions,
  left,
  brand,
  palette = colors,
}: {
  title: string;
  subtitle?: string;
  actions?: Action[];
  left?: ReactNode;
  /** Show the compact Talkify lockup above the title. */
  brand?: boolean;
  palette?: Palette;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      {brand ? <View style={styles.brand}><BrandMark palette={palette} /></View> : null}
      <View style={styles.row}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {left}
          <View style={{ flex: 1 }}>
            {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: palette.accent }]}>{subtitle}</Text> : null}
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {actions?.map((a, i) => (
            <Pressable key={i} onPress={a.onPress} style={[styles.actionBtn, { backgroundColor: palette.glass2, borderColor: palette.stroke }]} hitSlop={8}>
              <Ionicons name={a.icon} size={20} color={palette.text} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 10 },
  brand: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  title: { fontFamily: font.display, fontSize: 32, letterSpacing: -0.4 },
  subtitle: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
