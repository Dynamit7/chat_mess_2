import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, LayoutChangeEvent } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { settingsApi, usersApi, authApi } from '@/lib/api';
import { BASE_URL } from '@/lib/config';
import { useAuth } from '@/state/auth';
import { colors, font, radius } from '@/theme/theme';

const LANGS = [
  { code: 'en', label: 'English' }, { code: 'ru', label: 'Русский' }, { code: 'uz', label: "O'zbek" },
  { code: 'es', label: 'Español' }, { code: 'de', label: 'Deutsch' }, { code: 'fr', label: 'Français' },
];

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const me = Number(user?.userId);
  const { section } = useLocalSearchParams<{ section?: string }>();

  const scrollRef = useRef<ScrollView>(null);
  const didScroll = useRef(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  // Land on (and briefly highlight) the section the user tapped on the profile.
  const onSectionLayout = (key: string) => (e: LayoutChangeEvent) => {
    if (didScroll.current || section !== key) return;
    didScroll.current = true;
    const y = e.nativeEvent.layout.y;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true }));
    setHighlight(key);
    setTimeout(() => setHighlight(null), 1400);
  };

  const [loading, setLoading] = useState(true);
  const [ghostMode, setGhostMode] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [language, setLanguage] = useState('en');
  const [twoFactor, setTwoFactor] = useState(false);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [langOpen, setLangOpen] = useState(false);
  const [twoFaModal, setTwoFaModal] = useState<null | 'enable' | 'disable'>(null);

  useEffect(() => {
    Promise.all([
      settingsApi.getPrivacy(me).catch(() => ({})),
      authApi.twoFactorStatus(me).catch(() => ({})),
      usersApi.blockedUsers(me).catch(() => []),
    ]).then(([priv, tfa, blk]: any[]) => {
      setGhostMode(!!priv?.ghostMode);
      setReadReceipts(priv?.readReceiptSetting ?? priv?.readReceipts ?? true);
      setAutoTranslate(!!priv?.autoTranslate);
      setLanguage(priv?.preferredLanguage || 'en');
      setTwoFactor(!!tfa?.twoFactorEnabled);
      setBlocked(Array.isArray(blk) ? blk : blk?.users || []);
    }).finally(() => setLoading(false));
  }, [me]);

  const toggleGhost = (v: boolean) => { setGhostMode(v); settingsApi.updateGhostMode(me, v).catch(() => setGhostMode(!v)); };
  const toggleReceipts = (v: boolean) => { setReadReceipts(v); settingsApi.updateReadReceipts(me, v).catch(() => setReadReceipts(!v)); };
  const toggleTranslate = (v: boolean) => { setAutoTranslate(v); settingsApi.updateTranslation(me, language, v).catch(() => setAutoTranslate(!v)); };
  const pickLang = (code: string) => { setLanguage(code); setLangOpen(false); settingsApi.updateTranslation(me, code, autoTranslate).catch(() => {}); };
  const unblock = (u: any) => {
    const id = u.id ?? u.userId ?? u.blockedId;
    setBlocked((prev) => prev.filter((x) => (x.id ?? x.userId ?? x.blockedId) !== id));
    usersApi.unblock(me, id).catch(() => {});
  };

  if (loading) {
    return <AuroraBackground><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></AuroraBackground>;
  }

  return (
    <AuroraBackground>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/profile'))} style={{ width: 24 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Настройки</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View onLayout={onSectionLayout('privacy')}>
          <Text style={styles.section}>Приватность</Text>
          <GlassCard padded={false} style={highlight === 'privacy' ? styles.cardHighlight : undefined}>
            <ToggleRow icon="eye-off-outline" label="Режим невидимки" sub="Скрыть статус «в сети» и время визита" value={ghostMode} onChange={toggleGhost} />
            <ToggleRow icon="checkmark-done-outline" label="Отчёты о прочтении" sub="Показывать, когда вы прочитали" value={readReceipts} onChange={toggleReceipts} border={false} />
          </GlassCard>
        </View>

        <View onLayout={onSectionLayout('security')}>
          <Text style={styles.section}>Безопасность</Text>
          <GlassCard padded={false} style={highlight === 'security' ? styles.cardHighlight : undefined}>
            <ToggleRow icon="lock-closed-outline" label="Двухфакторная аутентификация" sub={twoFactor ? 'Включена' : 'Добавьте дополнительный пароль'} value={twoFactor} onChange={(v) => setTwoFaModal(v ? 'enable' : 'disable')} border={false} />
          </GlassCard>
        </View>

        <View onLayout={onSectionLayout('translation')}>
          <Text style={styles.section}>Перевод</Text>
          <GlassCard padded={false} style={highlight === 'translation' ? styles.cardHighlight : undefined}>
            <ToggleRow icon="language-outline" label="Автоперевод" sub="Переводить входящие сообщения" value={autoTranslate} onChange={toggleTranslate} />
            <Pressable style={styles.row} onPress={() => setLangOpen(true)}>
              <View style={styles.icon}><Ionicons name="globe-outline" size={19} color={colors.accent} /></View>
              <Text style={styles.label}>Язык</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.value}>{LANGS.find((l) => l.code === language)?.label || language}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} style={{ marginLeft: 6 }} />
            </Pressable>
          </GlassCard>
        </View>

        <View onLayout={onSectionLayout('blocked')}>
          <Text style={styles.section}>Заблокированные</Text>
          <GlassCard padded={false} style={highlight === 'blocked' ? styles.cardHighlight : undefined}>
            {blocked.length === 0 ? (
              <Text style={styles.emptyRow}>Вы никого не заблокировали.</Text>
            ) : (
              blocked.map((u, i) => (
                <View key={u.id ?? u.userId ?? i} style={[styles.row, i < blocked.length - 1 && styles.rowBorder]}>
                  <Avatar name={u.username || u.nickname} src={u.avatar} size={36} />
                  <Text style={[styles.label, { marginLeft: 4 }]}>{u.username || u.nickname || 'User'}</Text>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => unblock(u)} style={styles.unblockBtn}><Text style={styles.unblockText}>Разблокировать</Text></Pressable>
                </View>
              ))
            )}
          </GlassCard>
        </View>

        <Text style={styles.section}>О приложении</Text>
        <GlassCard>
          <Text style={styles.aboutLine}>Rossi Messenger</Text>
          <Text style={styles.aboutSub}>Версия 1.0.0 · mobile</Text>
          <Text style={[styles.aboutSub, { marginTop: 10 }]}>Подключено к</Text>
          <Text style={styles.aboutMono}>{BASE_URL}</Text>
        </GlassCard>
      </ScrollView>

      {/* Language picker */}
      <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setLangOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Язык</Text>
          {LANGS.map((l) => (
            <Pressable key={l.code} style={styles.langRow} onPress={() => pickLang(l.code)}>
              <Text style={styles.langLabel}>{l.label}</Text>
              {language === l.code ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
            </Pressable>
          ))}
        </View>
      </Modal>

      {twoFaModal ? <TwoFactorModal mode={twoFaModal} me={me} onClose={(changed) => { if (changed) setTwoFactor(twoFaModal === 'enable'); setTwoFaModal(null); }} /> : null}
    </AuroraBackground>
  );
}

function ToggleRow({ icon, label, sub, value, onChange, border = true }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; value: boolean; onChange: (v: boolean) => void; border?: boolean }) {
  return (
    <View style={[styles.row, border && styles.rowBorder]}>
      <View style={styles.icon}><Ionicons name={icon} size={19} color={colors.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.stroke2 }} thumbColor={colors.white} />
    </View>
  );
}

function TwoFactorModal({ mode, me, onClose }: { mode: 'enable' | 'disable'; me: number; onClose: (changed: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!password || (mode === 'enable' && !twoFactorPassword)) { setError('Заполните все поля.'); return; }
    setLoading(true);
    try {
      if (mode === 'enable') await settingsApi.setupTwoFactor({ userId: me, password, twoFactorPassword });
      else await settingsApi.disableTwoFactor({ userId: me, password });
      onClose(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось обновить.');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => onClose(false)} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={() => onClose(false)} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{mode === 'enable' ? 'Включить 2FA' : 'Отключить 2FA'}</Text>
          <Text style={styles.modalSub}>{mode === 'enable' ? 'Задайте отдельный пароль, который потребуется после каждого входа.' : 'Подтвердите пароль аккаунта, чтобы отключить.'}</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="Пароль аккаунта" placeholderTextColor={colors.textFaint} secureTextEntry style={styles.modalInput} />
          {mode === 'enable' ? (
            <TextInput value={twoFactorPassword} onChangeText={setTwoFactorPassword} placeholder="Новый двухфакторный пароль" placeholderTextColor={colors.textFaint} secureTextEntry style={styles.modalInput} />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={mode === 'enable' ? 'Включить' : 'Отключить'} onPress={submit} loading={loading} style={{ marginTop: 12 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 20 },
  section: { color: colors.textFaint, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.stroke },
  cardHighlight: { borderColor: colors.accent },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontFamily: font.bodyMed, fontSize: 15 },
  sub: { color: colors.textFaint, fontFamily: font.body, fontSize: 12.5, marginTop: 2 },
  value: { color: colors.textDim, fontFamily: font.body, fontSize: 14 },
  emptyRow: { color: colors.textFaint, fontFamily: font.body, fontSize: 14, padding: 18, textAlign: 'center' },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.stroke2 },
  unblockText: { color: colors.text, fontFamily: font.bodySemi, fontSize: 13 },
  aboutLine: { color: colors.text, fontFamily: font.bodySemi, fontSize: 16 },
  aboutSub: { color: colors.textDim, fontFamily: font.body, fontSize: 13, marginTop: 3 },
  aboutMono: { color: colors.accent, fontFamily: font.mono, fontSize: 13, marginTop: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: colors.stroke, paddingHorizontal: 18, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.stroke2, marginBottom: 12 },
  sheetTitle: { color: colors.text, fontFamily: font.bodySemi, fontSize: 17, marginBottom: 10 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.stroke },
  langLabel: { color: colors.text, fontFamily: font.bodyMed, fontSize: 15 },
  modalSub: { color: colors.textDim, fontFamily: font.body, fontSize: 14, marginBottom: 14, lineHeight: 20 },
  modalInput: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.stroke, borderRadius: radius.md, paddingHorizontal: 16, height: 52, color: colors.text, fontFamily: font.body, fontSize: 16, marginBottom: 10 },
  error: { color: colors.danger, fontFamily: font.bodyMed, fontSize: 13, marginBottom: 4 },
});
