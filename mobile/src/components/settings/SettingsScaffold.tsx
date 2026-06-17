import { ReactNode, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { font, radius, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';

/** Themed styles for every settings sub-page, rebuilt when the palette changes. */
export function useSettingsTheme() {
  const { c, scheme } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  return { c, s, scheme };
}

/** Shared shell for every settings sub-page: themed background, back header, scroll body. */
export function SettingsScaffold({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, s, scheme } = useSettingsTheme();
  return (
    <AuroraBackground palette={c}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/profile'))}
          style={{ width: 24 }}
        >
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={s.title}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </AuroraBackground>
  );
}

export function ToggleRow({ icon, label, sub, value, onChange, border = true }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; value: boolean; onChange: (v: boolean) => void; border?: boolean;
}) {
  const { c, s } = useSettingsTheme();
  return (
    <View style={[s.row, border && s.rowBorder]}>
      <View style={s.icon}><Ionicons name={icon} size={19} color={c.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.sub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.stroke2 }} thumbColor={c.white} />
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  title: { color: c.text, fontFamily: font.display, fontSize: 20 },
  section: { color: c.textFaint, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.stroke },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  label: { color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  sub: { color: c.textFaint, fontFamily: font.body, fontSize: 12.5, marginTop: 2 },
  value: { color: c.textDim, fontFamily: font.body, fontSize: 14 },
  hint: { color: c.textFaint, fontFamily: font.body, fontSize: 13, lineHeight: 19, marginTop: 12, marginLeft: 4 },
  emptyRow: { color: c.textFaint, fontFamily: font.body, fontSize: 14, padding: 18, textAlign: 'center' },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.stroke2 },
  unblockText: { color: c.text, fontFamily: font.bodySemi, fontSize: 13 },
  aboutLine: { color: c.text, fontFamily: font.bodySemi, fontSize: 16 },
  aboutSub: { color: c.textDim, fontFamily: font.body, fontSize: 13, marginTop: 3 },
  aboutMono: { color: c.accent, fontFamily: font.mono, fontSize: 13, marginTop: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: c.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: c.stroke, paddingHorizontal: 18, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.stroke2, marginBottom: 12 },
  sheetTitle: { color: c.text, fontFamily: font.bodySemi, fontSize: 17, marginBottom: 10 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.stroke },
  langLabel: { color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  modalSub: { color: c.textDim, fontFamily: font.body, fontSize: 14, marginBottom: 14, lineHeight: 20 },
  modalInput: { backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke, borderRadius: radius.md, paddingHorizontal: 16, height: 52, color: c.text, fontFamily: font.body, fontSize: 16, marginBottom: 10 },
  error: { color: c.danger, fontFamily: font.bodyMed, fontSize: 13, marginBottom: 4 },
  // Hub (index) menu rows
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  menuLabel: { color: c.text, fontFamily: font.bodyMed, fontSize: 15, flex: 1 },
});
