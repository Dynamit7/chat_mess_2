import { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { settingsApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useT } from '@/i18n';
import { SettingsScaffold, ToggleRow, useSettingsTheme } from '@/components/settings/SettingsScaffold';

export default function PrivacySettings() {
  const { user } = useAuth();
  const me = Number(user?.userId);
  const { t } = useT();
  const { c, s } = useSettingsTheme();
  const [loading, setLoading] = useState(true);
  const [ghostMode, setGhostMode] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);

  useEffect(() => {
    settingsApi.getPrivacy(me).catch(() => ({})).then((priv: any) => {
      setGhostMode(!!priv?.ghostMode);
      setReadReceipts(priv?.readReceiptSetting ?? priv?.readReceipts ?? true);
    }).finally(() => setLoading(false));
  }, [me]);

  const toggleGhost = (v: boolean) => { setGhostMode(v); settingsApi.updateGhostMode(me, v).catch(() => setGhostMode(!v)); };
  const toggleReceipts = (v: boolean) => { setReadReceipts(v); settingsApi.updateReadReceipts(me, v).catch(() => setReadReceipts(!v)); };

  return (
    <SettingsScaffold title={t('privacy.title')}>
      {loading ? (
        <View style={[s.center, { paddingTop: 60 }]}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <GlassCard padded={false} palette={c} style={{ marginTop: 12 }}>
          <ToggleRow icon="eye-off-outline" label={t('privacy.ghost')} sub={t('privacy.ghostSub')} value={ghostMode} onChange={toggleGhost} />
          <ToggleRow icon="checkmark-done-outline" label={t('privacy.receipts')} sub={t('privacy.receiptsSub')} value={readReceipts} onChange={toggleReceipts} border={false} />
        </GlassCard>
      )}
    </SettingsScaffold>
  );
}
