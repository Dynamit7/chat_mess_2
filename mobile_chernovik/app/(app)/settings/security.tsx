import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { settingsApi, authApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useT } from '@/i18n';
import { SettingsScaffold, ToggleRow, useSettingsTheme } from '@/components/settings/SettingsScaffold';

export default function SecuritySettings() {
  const { user } = useAuth();
  const me = Number(user?.userId);
  const { t } = useT();
  const { c, s } = useSettingsTheme();
  const [loading, setLoading] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFaModal, setTwoFaModal] = useState<null | 'enable' | 'disable'>(null);

  useEffect(() => {
    authApi.twoFactorStatus(me).catch(() => ({})).then((tfa: any) => {
      setTwoFactor(!!tfa?.twoFactorEnabled);
    }).finally(() => setLoading(false));
  }, [me]);

  return (
    <SettingsScaffold title={t('security.title')}>
      {loading ? (
        <View style={[s.center, { paddingTop: 60 }]}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <>
          <GlassCard padded={false} palette={c} style={{ marginTop: 12 }}>
            <ToggleRow
              icon="lock-closed-outline"
              label={t('security.twoFactor')}
              sub={twoFactor ? t('security.enabled') : t('security.addExtra')}
              value={twoFactor}
              onChange={(v) => setTwoFaModal(v ? 'enable' : 'disable')}
              border={false}
            />
          </GlassCard>
          <Text style={s.hint}>{t('security.hint')}</Text>
        </>
      )}

      {twoFaModal ? (
        <TwoFactorModal
          mode={twoFaModal}
          me={me}
          onClose={(changed) => { if (changed) setTwoFactor(twoFaModal === 'enable'); setTwoFaModal(null); }}
        />
      ) : null}
    </SettingsScaffold>
  );
}

function TwoFactorModal({ mode, me, onClose }: { mode: 'enable' | 'disable'; me: number; onClose: (changed: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { c, s } = useSettingsTheme();
  const [password, setPassword] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!password || (mode === 'enable' && !twoFactorPassword)) { setError(t('security.fillAll')); return; }
    setLoading(true);
    try {
      if (mode === 'enable') await settingsApi.setupTwoFactor({ userId: me, password, twoFactorPassword });
      else await settingsApi.disableTwoFactor({ userId: me, password });
      onClose(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || t('security.updateFailed'));
    } finally { setLoading(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => onClose(false)} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={() => onClose(false)} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 14 }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{mode === 'enable' ? t('security.enableTitle') : t('security.disableTitle')}</Text>
          <Text style={s.modalSub}>{mode === 'enable' ? t('security.enableSub') : t('security.disableSub')}</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder={t('security.accountPassword')} placeholderTextColor={c.textFaint} secureTextEntry style={s.modalInput} />
          {mode === 'enable' ? (
            <TextInput value={twoFactorPassword} onChangeText={setTwoFactorPassword} placeholder={t('security.newTwoFactorPassword')} placeholderTextColor={c.textFaint} secureTextEntry style={s.modalInput} />
          ) : null}
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button label={mode === 'enable' ? t('security.enable') : t('security.disable')} onPress={submit} loading={loading} style={{ marginTop: 12 }} palette={c} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
