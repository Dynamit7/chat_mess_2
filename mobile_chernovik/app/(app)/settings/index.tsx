import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { BASE_URL } from '@/lib/config';
import { useT, TKey } from '@/i18n';
import { SettingsScaffold, useSettingsTheme } from '@/components/settings/SettingsScaffold';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: TKey; sub: TKey; route: string };

const ITEMS: Item[] = [
  { icon: 'shield-checkmark-outline', label: 'nav.privacy', sub: 'nav.privacySub', route: '/(app)/settings/privacy' },
  { icon: 'lock-closed-outline', label: 'nav.security', sub: 'nav.securitySub', route: '/(app)/settings/security' },
  { icon: 'color-palette-outline', label: 'nav.appearance', sub: 'nav.appearanceSub', route: '/(app)/settings/appearance' },
  { icon: 'language-outline', label: 'nav.translation', sub: 'nav.translationSub', route: '/(app)/settings/translation' },
  { icon: 'person-remove-outline', label: 'nav.blocked', sub: 'nav.blockedSub', route: '/(app)/settings/blocked' },
];

export default function SettingsHub() {
  const router = useRouter();
  const { t } = useT();
  const { c, s } = useSettingsTheme();
  return (
    <SettingsScaffold title={t('settings.title')}>
      <Text style={s.section}>{t('profile.settings')}</Text>
      <GlassCard padded={false} palette={c}>
        {ITEMS.map((it, i) => (
          <Pressable
            key={it.route}
            onPress={() => router.push(it.route as any)}
            style={[s.menuRow, i < ITEMS.length - 1 && s.rowBorder]}
          >
            <View style={s.icon}><Ionicons name={it.icon} size={19} color={c.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{t(it.label)}</Text>
              <Text style={s.sub}>{t(it.sub)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
          </Pressable>
        ))}
      </GlassCard>

      <Text style={s.section}>{t('settings.about')}</Text>
      <GlassCard palette={c}>
        <Text style={s.aboutLine}>Talkify</Text>
        <Text style={s.aboutSub}>{t('settings.version')}</Text>
        <Text style={[s.aboutSub, { marginTop: 10 }]}>{t('settings.connectedTo')}</Text>
        <Text style={s.aboutMono}>{BASE_URL}</Text>
      </GlassCard>
    </SettingsScaffold>
  );
}
