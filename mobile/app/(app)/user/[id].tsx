import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { colors, font, radius, gradients } from '@/theme/theme';

export default function UserProfileScreen() {
  const { user: me } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const userId = Number(params.id);
  const myId = Number(me?.userId);

  const [profile, setProfile] = useState<any>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      usersApi.getById(userId),
      usersApi.online(userId).catch(() => ({ isOnline: false })),
    ])
      .then(([p, o]) => {
        setProfile(p);
        setOnline(o?.isOnline ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const name = profile?.username || profile?.nickname || params.name || 'User';
  const avatar = profile?.avatar || profile?.picture || params.avatar || undefined;

  const openChat = () =>
    router.push({ pathname: '/(app)/chat/[id]', params: { id: String(userId), name, avatar: avatar || '' } });

  const openCall = (video = false) =>
    router.push({ pathname: '/(app)/call/[id]', params: { id: String(userId), name, avatar: avatar || '', incoming: 'false' } });

  return (
    <AuroraBackground>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Профиль</Text>
        <View style={{ width: 40 }} />
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
            <Avatar name={name} src={avatar} size={110} ring />
            <Text style={styles.heroName}>{name}</Text>
            <View style={styles.onlineRow}>
              <View style={[styles.dot, { backgroundColor: online ? colors.online : colors.textFaint }]} />
              <Text style={[styles.onlineText, { color: online ? colors.online : colors.textFaint }]}>
                {online ? 'В сети' : 'Не в сети'}
              </Text>
            </View>
          </View>

          {/* Quick actions (only for other users) */}
          {userId !== myId && (
            <View style={styles.actions}>
              <ActionChip icon="chatbubble" label="Написать" onPress={openChat} />
              <ActionChip icon="call" label="Звонок" onPress={() => openCall(false)} />
              <ActionChip icon="videocam" label="Видео" onPress={() => openCall(true)} />
            </View>
          )}

          {/* Info */}
          <Text style={styles.section}>Информация</Text>
          <GlassCard padded={false}>
            <InfoRow icon="person-outline" label="Имя пользователя" value={`@${name}`} last />
          </GlassCard>
        </ScrollView>
      )}
    </AuroraBackground>
  );
}

function ActionChip({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
    >
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chipIcon}>
        <Ionicons name={icon} size={20} color={colors.ink} />
      </LinearGradient>
      <Text style={styles.chipLabel}>{label}</Text>
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
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', gap: 10, paddingTop: 24, paddingBottom: 8 },
  heroName: { color: colors.text, fontFamily: font.display, fontSize: 26, letterSpacing: -0.5 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontFamily: font.bodyMed, fontSize: 14 },

  actions: {
    flexDirection: 'row', justifyContent: 'center', gap: 32,
    paddingVertical: 24,
  },
  chip: { alignItems: 'center', gap: 8 },
  chipIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 12 },

  section: {
    color: colors.textFaint, fontFamily: font.bodySemi, fontSize: 12,
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 22, marginBottom: 10, marginLeft: 24,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.stroke },
  infoIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, color: colors.text, fontFamily: font.bodyMed, fontSize: 15 },
  infoValue: { color: colors.textDim, fontFamily: font.body, fontSize: 14 },
});
