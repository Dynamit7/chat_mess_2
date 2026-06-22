import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { GlassCard } from '@/components/ui/GlassCard';
import { Avatar } from '@/components/ui/Avatar';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useT } from '@/i18n';
import { SettingsScaffold, useSettingsTheme } from '@/components/settings/SettingsScaffold';

export default function BlockedSettings() {
  const { user } = useAuth();
  const me = Number(user?.userId);
  const { t } = useT();
  const { c, s } = useSettingsTheme();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<any[]>([]);

  useEffect(() => {
    usersApi.blockedUsers(me).catch(() => []).then((blk: any) => {
      setBlocked(Array.isArray(blk) ? blk : blk?.users || []);
    }).finally(() => setLoading(false));
  }, [me]);

  const unblock = (u: any) => {
    const id = u.id ?? u.userId ?? u.blockedId;
    setBlocked((prev) => prev.filter((x) => (x.id ?? x.userId ?? x.blockedId) !== id));
    usersApi.unblock(me, id).catch(() => {});
  };

  return (
    <SettingsScaffold title={t('blocked.title')}>
      {loading ? (
        <View style={[s.center, { paddingTop: 60 }]}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <GlassCard padded={false} palette={c} style={{ marginTop: 12 }}>
          {blocked.length === 0 ? (
            <Text style={s.emptyRow}>{t('blocked.none')}</Text>
          ) : (
            blocked.map((u, i) => (
              <View key={u.id ?? u.userId ?? i} style={[s.row, i < blocked.length - 1 && s.rowBorder]}>
                <Avatar name={u.username || u.nickname} src={u.avatar} size={36} palette={c} />
                <Text style={[s.label, { marginLeft: 4 }]}>{u.username || u.nickname || t('blocked.user')}</Text>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => unblock(u)} style={s.unblockBtn}><Text style={s.unblockText}>{t('blocked.unblock')}</Text></Pressable>
              </View>
            ))
          )}
        </GlassCard>
      )}
    </SettingsScaffold>
  );
}
