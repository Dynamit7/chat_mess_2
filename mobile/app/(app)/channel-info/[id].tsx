import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { channelsApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { colors, font, gradients } from '@/theme/theme';

export default function ChannelInfoScreen() {
  const { user: me, isReady } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string; isMember?: string; members?: string }>();
  const channelId = Number(params.id);
  const myId = Number(me?.userId);

  const [channel, setChannel] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: number; name: string } | null>(null);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)/channels');
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !myId) return;
      channelsApi.getById(channelId)
        .then((c) => {
          setChannel(c);
          if (Number(c?.ownerId) === myId) {
            return channelsApi.members(channelId, myId).catch(() => []);
          }
          return [];
        })
        .then((m) => setMembers(Array.isArray(m) ? m : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [channelId, isReady, myId])
  );

  const name = channel?.name || params.name || 'Канал';
  const avatar = channel?.avatar || params.avatar || undefined;
  const subCount = channel?.subscribersCount ?? channel?.membersCount ?? Number(params.members ?? 0);
  const isMember = params.isMember !== 'false';
  const isOwner = Number(channel?.ownerId) === myId;

  const openChannel = () =>
    router.replace({
      pathname: '/(app)/channel/[id]',
      params: { id: String(channelId), name, avatar: avatar || '', ownerId: String(channel?.ownerId ?? ''), isMember: String(isMember), members: String(subCount) },
    });

  const leave = async () => {
    setLeaving(true);
    try {
      await channelsApi.leave(channelId, myId);
      goBack();
    } catch {
      setLeaving(false);
    }
  };

  const join = async () => {
    setLeaving(true);
    try {
      await channelsApi.join(channelId, myId);
      router.replace({
        pathname: '/(app)/channel/[id]',
        params: { id: String(channelId), name, avatar: avatar || '', ownerId: String(channel?.ownerId ?? ''), isMember: 'true', members: String(subCount) },
      });
    } catch {
      setLeaving(false);
    }
  };

  const removeMember = async () => {
    if (!confirmTarget) return;
    const { id: memberId } = confirmTarget;
    setConfirmTarget(null);
    setRemovingId(memberId);
    try {
      await channelsApi.removeMember(channelId, memberId, myId);
      setMembers((prev) => prev.filter((m) => Number(m.userId ?? m.id) !== memberId));
    } catch {
      // silent — member list stays unchanged
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <AuroraBackground>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={12} onPress={goBack} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Канал</Text>
        {isOwner ? (
          <Pressable
            hitSlop={12}
            style={styles.iconBtn}
            onPress={() => router.push({ pathname: '/(app)/edit/[id]', params: { id: String(channelId), kind: 'channel' } })}
          >
            <Ionicons name="create-outline" size={24} color={colors.accent} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Avatar name={name} src={avatar} size={100} ring />
            <Text style={styles.heroName}>{name}</Text>
            <Text style={styles.heroSub}>{subCount} подписчиков · Канал</Text>
          </View>

          {/* Quick actions */}
          <View style={styles.actions}>
            <ActionChip icon="megaphone" label="Открыть" onPress={openChannel} />
            {isMember ? (
              <ActionChip icon="exit-outline" label="Отписаться" onPress={leave} danger loading={leaving} />
            ) : (
              <ActionChip icon="add-circle" label="Подписаться" onPress={join} loading={leaving} />
            )}
          </View>

          {/* Description */}
          {channel?.description ? (
            <>
              <Text style={styles.section}>О канале</Text>
              <GlassCard padded={false}>
                <View style={styles.descRow}>
                  <View style={styles.infoIcon}><Ionicons name="information-circle-outline" size={18} color={colors.accent} /></View>
                  <Text style={styles.descText}>{channel.description}</Text>
                </View>
              </GlassCard>
            </>
          ) : null}

          {/* Info */}
          <Text style={styles.section}>Информация</Text>
          <GlassCard padded={false}>
            <InfoRow icon="people-outline" label="Подписчиков" value={String(subCount)} />
            <InfoRow icon="lock-closed-outline" label="Тип" value={channel?.isPublic ? 'Публичный' : 'Приватный'} last />
          </GlassCard>

          {/* Members — only for channel owner */}
          {isOwner && members.length > 0 && (
            <>
              <Text style={styles.section}>Участники</Text>
              <GlassCard padded={false}>
                {members.map((m: any, i: number) => {
                  const mId = Number(m.userId ?? m.id);
                  const mName = m.username || m.nickname || `User ${mId}`;
                  const isMe = mId === myId;
                  const isRemoving = removingId === mId;
                  return (
                    <View
                      key={String(mId ?? i)}
                      style={[styles.memberRow, i < members.length - 1 && styles.memberBorder]}
                    >
                      <Pressable
                        style={styles.memberInfo}
                        onPress={() => router.push({ pathname: '/(app)/user/[id]', params: { id: String(mId), name: mName, avatar: m.avatar || m.picture || '' } })}
                      >
                        <Avatar name={mName} src={m.avatar || m.picture} size={42} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{mName}</Text>
                          {isMe && <Text style={styles.memberRole}>Вы (владелец)</Text>}
                        </View>
                      </Pressable>
                      {!isMe && (
                        <Pressable
                          hitSlop={10}
                          onPress={() => setConfirmTarget({ id: mId, name: mName })}
                          style={styles.removeBtn}
                          disabled={isRemoving}
                        >
                          {isRemoving
                            ? <ActivityIndicator size="small" color={colors.danger} />
                            : <Ionicons name="person-remove-outline" size={20} color={colors.danger} />
                          }
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </GlassCard>
            </>
          )}
        </ScrollView>
      )}

      {/* Confirm remove modal */}
      <Modal
        visible={!!confirmTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmTarget(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setConfirmTarget(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetIconWrap}>
              <View style={styles.sheetIconBg}>
                <Ionicons name="person-remove-outline" size={28} color={colors.danger} />
              </View>
            </View>

            <Text style={styles.sheetTitle}>Удалить участника</Text>
            <Text style={styles.sheetBody}>
              Вы уверены, что хотите удалить{'\n'}
              <Text style={styles.sheetName}>{confirmTarget?.name}</Text>
              {' '}из канала?
            </Text>

            <Pressable style={styles.btnDanger} onPress={removeMember}>
              <Text style={styles.btnDangerText}>Удалить</Text>
            </Pressable>
            <Pressable style={styles.btnCancel} onPress={() => setConfirmTarget(null)}>
              <Text style={styles.btnCancelText}>Отмена</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AuroraBackground>
  );
}

function ActionChip({ icon, label, onPress, danger, loading: isLoading }: { icon: any; label: string; onPress: () => void; danger?: boolean; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
      {danger ? (
        <View style={[styles.chipIcon, { backgroundColor: colors.danger }]}>
          {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={icon} size={20} color="#fff" />}
        </View>
      ) : (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chipIcon}>
          {isLoading ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name={icon} size={20} color={colors.ink} />}
        </LinearGradient>
      )}
      <Text style={[styles.chipLabel, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={18} color={colors.accent} /></View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 8,
  },
  headerTitle: { color: colors.text, fontFamily: font.bodySemi, fontSize: 17 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', gap: 10, paddingTop: 24, paddingBottom: 8 },
  heroName: { color: colors.text, fontFamily: font.display, fontSize: 26, letterSpacing: -0.5 },
  heroSub: { color: colors.textFaint, fontFamily: font.bodyMed, fontSize: 14 },

  actions: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 24 },
  chip: { alignItems: 'center', gap: 8 },
  chipIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 12 },

  section: {
    color: colors.textFaint, fontFamily: font.bodySemi, fontSize: 12,
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 22, marginBottom: 10, marginLeft: 24,
  },

  descRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  descText: { flex: 1, color: colors.textDim, fontFamily: font.body, fontSize: 15, lineHeight: 22 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.stroke },
  infoIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, color: colors.text, fontFamily: font.bodyMed, fontSize: 15 },
  infoValue: { color: colors.textDim, fontFamily: font.body, fontSize: 14 },

  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  memberBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.stroke },
  memberInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  memberName: { color: colors.text, fontFamily: font.bodyMed, fontSize: 15 },
  memberRole: { color: colors.accent, fontFamily: font.body, fontSize: 12, marginTop: 1 },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface ?? '#1a1a2e',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.stroke, marginBottom: 24,
  },
  sheetIconWrap: { marginBottom: 16 },
  sheetIconBg: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,59,48,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: {
    color: colors.text, fontFamily: font.display,
    fontSize: 20, marginBottom: 10,
  },
  sheetBody: {
    color: colors.textDim, fontFamily: font.body,
    fontSize: 15, lineHeight: 22,
    textAlign: 'center', marginBottom: 28,
  },
  sheetName: { color: colors.text, fontFamily: font.bodySemi },
  btnDanger: {
    width: '100%', height: 52, borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  btnDangerText: { color: '#fff', fontFamily: font.bodySemi, fontSize: 16 },
  btnCancel: {
    width: '100%', height: 52, borderRadius: 16,
    backgroundColor: colors.accentSoft ?? 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnCancelText: { color: colors.text, fontFamily: font.bodyMed, fontSize: 16 },
});
