import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { useT, TKey } from '@/i18n';
import { useTheme, ThemeMode } from '@/theme/ThemeContext';
import { SettingsScaffold, useSettingsTheme } from '@/components/settings/SettingsScaffold';
import { THEME_META, font, Palette } from '@/theme/theme';

type Opt = { mode: ThemeMode; icon: keyof typeof Ionicons.glyphMap; label: TKey; sub: TKey };

const OPTIONS: Opt[] = [
  { mode: 'system', icon: 'phone-portrait-outline', label: 'appearance.system', sub: 'appearance.systemSub' },
  { mode: 'light', icon: 'sunny-outline', label: 'appearance.light', sub: 'appearance.lightSub' },
  { mode: 'dark', icon: 'moon-outline', label: 'appearance.dark', sub: 'appearance.darkSub' },
];

export default function AppearanceSettings() {
  const { t } = useT();
  const { c, s } = useSettingsTheme();
  const { mode, setMode, themeId, setThemeId } = useTheme();
  const ls = makeLocal(c);

  return (
    <SettingsScaffold title={t('appearance.title')}>
      {/* ── Colour theme: 5 swatches ─────────────────────────────── */}
      <Text style={[s.section, { marginTop: 8 }]}>{t('appearance.themeSection')}</Text>
      <GlassCard padded palette={c}>
        <View style={ls.swatchGrid}>
          {THEME_META.map((th) => {
            const active = themeId === th.id;
            return (
              <Pressable key={th.id} style={ls.swatchCell} onPress={() => setThemeId(th.id)}>
                <View style={[ls.swatchRing, active && { borderColor: c.accent }]}>
                  <LinearGradient
                    colors={th.swatch}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={ls.swatch}
                  >
                    {active ? <Ionicons name="checkmark" size={22} color="#fff" /> : null}
                  </LinearGradient>
                </View>
                <Text style={[ls.swatchLabel, active && { color: c.text }]} numberOfLines={1}>{th.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      {/* ── Light / dark / system ────────────────────────────────── */}
      <Text style={s.section}>{t('appearance.modeSection')}</Text>
      <GlassCard padded={false} palette={c}>
        {OPTIONS.map((o, i) => {
          const active = mode === o.mode;
          return (
            <Pressable key={o.mode} style={[s.row, i < OPTIONS.length - 1 && s.rowBorder]} onPress={() => setMode(o.mode)}>
              <View style={s.icon}><Ionicons name={o.icon} size={19} color={c.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t(o.label)}</Text>
                <Text style={s.sub}>{t(o.sub)}</Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={22} color={c.accent} /> : <Ionicons name="ellipse-outline" size={22} color={c.stroke2} />}
            </Pressable>
          );
        })}
      </GlassCard>
    </SettingsScaffold>
  );
}

const makeLocal = (c: Palette) => StyleSheet.create({
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  swatchCell: { width: 58, alignItems: 'center', gap: 7 },
  swatchRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  swatch: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    // soft lift so the swatches read as physical chips
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  swatchLabel: { color: c.textFaint, fontFamily: font.bodyMed, fontSize: 11.5 },
});
