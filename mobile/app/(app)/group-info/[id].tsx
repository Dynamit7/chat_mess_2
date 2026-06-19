import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { AddMembersSheet, PickUser } from '@/components/social/AddMembersSheet';
import { groupsApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/theme/ThemeContext';
import { font, gradients, radius, Palette } from '@/theme/theme';

type S = ReturnType<typeof makeStyles>;

export default function GroupInfoScreen() {
  const { user: me } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string; isMember?: string }>();
  const groupId = Number(params.id);
  const myId = Number(me?.userId);

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [adding, setAdding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        groupsApi.getById(groupId).catch(() => null),
        groupsApi.members(groupId).catch(() => []),
      ])
        .then(([g, m]) => {
          setGroup(g);
          setMembers(Array.isArray(m) ? m : []);
        })
        .finally(() => setLoading(false));
    }, [groupId])
  );

  const name = group?.name || params.name || 'Группа';
  const avatar = group?.avatar || params.avatar || undefined;
  const memberCount = members.length || group?.membersCount || 0;
  const isMember = params.isMember !== 'false';
  const isOwner = Number(group?.ownerId) === myId;

  const openChat = () =>
    router.replace({
      pathname: '/(app)/group/[id]',
      params: { id: String(groupId), name, avatar: avatar || '', ownerId: String(group?.ownerId ?? ''), isMember: String(isMember) },
    });

  const leave = async () => {
    setLeaving(true);
    try {
      await groupsApi.leave(groupId, myId);
      router.back();
    } catch {
      setLeaving(false);
    }
  };

  // Owner adds a member: join with addedBy=ownerId (works for private & public).
  const addMember = async (u: PickUser) => {
    await groupsApi.join(groupId, u.id, myId);
    setMembers((prev) =>
      prev.some((m) => Number(m.userId ?? m.id) === u.id)
        ? prev
        : [...prev, { id: u.id, userId: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar }]
    );
  };

  return (
    <AuroraBackground palette={c}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Группа</Text>
        {isOwner ? (
          <Pressable
            hitSlop={12}
            style={styles.iconBtn}
            onPress={() => router.push({ pathname: '/(app)/edit/[id]', params: { id: String(groupId), kind: 'group' } })}
          >
            <Ionicons name="create-outline" size={24} color={c.accent} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.accent} size="large" /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Avatar name={name} src={avatar} size={100} ring palette={c} />
            <Text style={styles.heroName}>{name}</Text>
            <Text style={styles.heroSub}>{memberCount} участников · Группа</Text>
          </View>

          {/* Quick actions */}
          <View style={styles.actions}>
            <ActionChip icon="chatbubbles" label="Открыть" onPress={openChat} styles={styles} c={c} />
            {isOwner && (
              <ActionChip icon="person-add" label="Добавить" onPress={() => setAdding(true)} styles={styles} c={c} />
            )}
            {isMember && (
              <ActionChip icon="exit-outline" label="Покинуть" onPress={leave} danger loading={leaving} styles={styles} c={c} />
            )}
          </View>

          {/* Description */}
          {group?.description ? (
            <>
              <Text style={styles.section}>О группе</Text>
              <GlassCard padded={false} palette={c}>
                <View style={styles.descRow}>
                  <View style={styles.infoIcon}><Ionicons name="information-circle-outline" size={18} color={c.accent} /></View>
                  <Text style={styles.descText}>{group.description}</Text>
                </View>
              </GlassCard>
            </>
          ) : null}

          {/* Info */}
          <Text style={styles.section}>Информация</Text>
          <GlassCard padded={false} palette={c}>
            <InfoRow icon="people-outline" label="Участников" value={String(memberCount)} styles={styles} c={c} />
            <InfoRow icon="lock-closed-outline" label="Тип" value={group?.isPublic ? 'Публичная' : 'Приватная'} last styles={styles} c={c} />
          </GlassCard>

          {/* Members */}
          {members.length > 0 && (
            <>
              <Text style={styles.section}>Участники</Text>
              <GlassCard padded={false} palette={c}>
                {members.slice(0, 10).map((m: any, i: number) => {
                  const mName = m.username || m.nickname || `User ${m.userId ?? m.id}`;
                  const mId = m.userId ?? m.id;
                  return (
                    <Pressable
                      key={String(mId ?? i)}
                      style={[styles.memberRow, i < Math.min(members.length, 10) - 1 && styles.memberBorder]}
                      onPress={() => router.push({ pathname: '/(app)/user/[id]', params: { id: String(mId), name: mName, avatar: m.avatar || m.picture || '' } })}
                    >
                      <Avatar name={mName} src={m.avatar || m.picture} size={42} palette={c} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{mName}</Text>
                        {(m.role === 'owner' || m.isOwner || Number(m.userId ?? m.id) === group?.ownerId) && (
                          <Text style={styles.memberRole}>Владелец</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                    </Pressable>
                  );
                })}
                {members.length > 10 && (
                  <View style={styles.moreRow}>
                    <Text style={styles.moreText}>И ещё {members.length - 10} участников</Text>
                  </View>
                )}
              </GlassCard>
            </>
          )}
        </ScrollView>
      )}

      <AddMembersSheet
        visible={adding}
        myId={myId}
        title="Добавить в группу"
        excludeIds={members.map((m: any) => Number(m.userId ?? m.id))}
        onClose={() => setAdding(false)}
        onPick={addMember}
      />
    </AuroraBackground>
  );
}

function ActionChip({ icon, label, onPress, danger, loading: isLoading, styles, c }: { icon: any; label: string; onPress: () => void; danger?: boolean; loading?: boolean; styles: S; c: Palette }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
      {danger ? (
        <View style={[styles.chipIcon, { backgroundColor: c.danger }]}>
          {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={icon} size={20} color="#fff" />}
        </View>
      ) : (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chipIcon}>
          <Ionicons name={icon} size={20} color={c.ink} />
        </LinearGradient>
      )}
      <Text style={[styles.chipLabel, danger && { color: c.danger }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ icon, label, value, last, styles, c }: { icon: any; label: string; value: string; last?: boolean; styles: S; c: Palette }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={18} color={c.accent} /></View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 8,
  },
  headerTitle: { color: c.text, fontFamily: font.bodySemi, fontSize: 17 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', gap: 10, paddingTop: 24, paddingBottom: 8 },
  heroName: { color: c.text, fontFamily: font.display, fontSize: 26, letterSpacing: -0.5 },
  heroSub: { color: c.textFaint, fontFamily: font.bodyMed, fontSize: 14 },

  actions: { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 24 },
  chip: { alignItems: 'center', gap: 8 },
  chipIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 12 },

  section: {
    color: c.textFaint, fontFamily: font.bodySemi, fontSize: 12,
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 22, marginBottom: 10, marginLeft: 24,
  },

  descRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  descText: { flex: 1, color: c.textDim, fontFamily: font.body, fontSize: 15, lineHeight: 22 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.stroke },
  infoIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  infoValue: { color: c.textDim, fontFamily: font.body, fontSize: 14 },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  memberBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.stroke },
  memberName: { color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  memberRole: { color: c.accent, fontFamily: font.body, fontSize: 12, marginTop: 1 },

  moreRow: { paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  moreText: { color: c.textFaint, fontFamily: font.bodyMed, fontSize: 14 },
});
