import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { settingsApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useT, LANGUAGES, LangCode } from '@/i18n';
import { SettingsScaffold, ToggleRow, useSettingsTheme } from '@/components/settings/SettingsScaffold';

export default function TranslationSettings() {
  const { user } = useAuth();
  const me = Number(user?.userId);
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useT();
  const { c, s } = useSettingsTheme();
  const [loading, setLoading] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    settingsApi.getPrivacy(me).catch(() => ({})).then((priv: any) => {
      setAutoTranslate(!!priv?.autoTranslate);
    }).finally(() => setLoading(false));
  }, [me]);

  const toggleTranslate = (v: boolean) => { setAutoTranslate(v); settingsApi.updateTranslation(me, lang, v).catch(() => setAutoTranslate(!v)); };
  // Picking a language switches the interface immediately AND saves it as the
  // translation target on the server.
  const pickLang = (code: LangCode) => {
    setLang(code);
    setLangOpen(false);
    settingsApi.updateTranslation(me, code, autoTranslate).catch(() => {});
  };

  return (
    <SettingsScaffold title={t('translation.title')}>
      {loading ? (
        <View style={[s.center, { paddingTop: 60 }]}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <>
          <GlassCard padded={false} palette={c} style={{ marginTop: 12 }}>
            <ToggleRow icon="language-outline" label={t('translation.auto')} sub={t('translation.autoSub')} value={autoTranslate} onChange={toggleTranslate} />
            <Pressable style={s.row} onPress={() => setLangOpen(true)}>
              <View style={s.icon}><Ionicons name="globe-outline" size={19} color={c.accent} /></View>
              <Text style={s.label}>{t('translation.language')}</Text>
              <View style={{ flex: 1 }} />
              <Text style={s.value}>{LANGUAGES.find((l) => l.code === lang)?.label || lang}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textFaint} style={{ marginLeft: 6 }} />
            </Pressable>
          </GlassCard>
          <Text style={s.hint}>{t('translation.interfaceHint')}</Text>
        </>
      )}

      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)} statusBarTranslucent>
        <Pressable style={s.backdrop} onPress={() => setLangOpen(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{t('translation.language')}</Text>
          {LANGUAGES.map((l) => (
            <Pressable key={l.code} style={s.langRow} onPress={() => pickLang(l.code)}>
              <Text style={s.langLabel}>{l.label}</Text>
              {lang === l.code ? <Ionicons name="checkmark" size={20} color={c.accent} /> : null}
            </Pressable>
          ))}
        </View>
      </Modal>
    </SettingsScaffold>
  );
}
