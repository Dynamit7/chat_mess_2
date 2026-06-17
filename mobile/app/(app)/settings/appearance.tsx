import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { useT, TKey } from '@/i18n';
import { useTheme, ThemeMode } from '@/theme/ThemeContext';
import { SettingsScaffold, useSettingsTheme } from '@/components/settings/SettingsScaffold';

type Opt = { mode: ThemeMode; icon: keyof typeof Ionicons.glyphMap; label: TKey; sub: TKey };

const OPTIONS: Opt[] = [
  { mode: 'system', icon: 'phone-portrait-outline', label: 'appearance.system', sub: 'appearance.systemSub' },
  { mode: 'light', icon: 'sunny-outline', label: 'appearance.light', sub: 'appearance.lightSub' },
  { mode: 'dark', icon: 'moon-outline', label: 'appearance.dark', sub: 'appearance.darkSub' },
];

export default function AppearanceSettings() {
  const { t } = useT();
  const { c, s } = useSettingsTheme();
  const { mode, setMode } = useTheme();

  return (
    <SettingsScaffold title={t('appearance.title')}>
      <GlassCard padded={false} palette={c} style={{ marginTop: 12 }}>
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
