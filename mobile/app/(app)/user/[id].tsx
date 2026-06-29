import { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import { usersApi } from '@/lib/api';
import { cacheGet, cacheSet, cacheKeys } from '@/lib/offlineCache';
import { getIsOnline } from '@/lib/net';
import { fixFileUrl } from '@/lib/config';
import { useAuth } from '@/state/auth';
import { useCall } from '@/state/call';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';
import { font, radius, gradients, Palette } from '@/theme/theme';

type S = ReturnType<typeof makeStyles>;

export default function UserProfileScreen() {
  const { user: me } = useAuth();
  const call = useCall();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const userId = Number(params.id);
  const myId = Number(me?.userId);

  const [profile, setProfile] = useState<any>(null);
  const [online, setOnline] = useState(false);
  const [bgRefreshing, setBgRefreshing] = useState(false);
  const [viewer, setViewer] = useState(false);

  // Avoid refetching on every focus when we just loaded — Telegram-style.
  const lastLoadRef = useRef(0);
  const REFRESH_THROTTLE_MS = 30_000;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      // 1) Paint instantly from cache so the profile never opens on a blank
      //    spinner (params already give us name+avatar; cache fills the rest).
      cacheGet<any>(cacheKeys.userProfile(userId)).then((cached) => {
        if (alive && cached) setProfile((prev: any) => prev ?? cached);
      });
      // 2) Offline → stop here, the cached/param data stays on screen.
      // 3) Throttle: skip the network hit if we refreshed very recently.
      if (Date.now() - lastLoadRef.current < REFRESH_THROTTLE_MS && profile) return;
      (async () => {
        if (!(await getIsOnline())) return;
        setBgRefreshing(true);
        try {
          const [p, o] = await Promise.all([
            usersApi.getById(userId),
            usersApi.online(userId).catch(() => ({ isOnline: false })),
          ]);
          if (!alive) return;
          setProfile(p);
          setOnline(o?.isOnline ?? false);
          cacheSet(cacheKeys.userProfile(userId), p);
          lastLoadRef.current = Date.now();
        } catch {
          /* keep cached/param data on screen */
        } finally {
          if (alive) setBgRefreshing(false);
        }
      })();
      return () => { alive = false; };
    }, [userId])
  );

  const name = profile?.username || profile?.nickname || params.name || 'User';
  const avatar = profile?.avatar || profile?.picture || params.avatar || undefined;

  const openChat = () =>
    router.push({ pathname: '/(app)/chat/[id]', params: { id: String(userId), name, avatar: avatar || '' } });

  const openCall = async (video = false) => {
    if (!call.available) {
      Alert.alert('Звонки недоступны', 'Звонки работают только в установленном приложении (не в Expo Go). Соберите dev-build.');
      return;
    }
    await call.startCall({ id: userId, name, avatar: avatar || '' }, { video });
    router.push({ pathname: '/(app)/call/[id]', params: { id: String(userId), name, avatar: avatar || '', video: video ? 'true' : 'false' } });
  };

  return (
    <AuroraBackground palette={c}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('tabs.profile')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {bgRefreshing ? <TopProgressBar palette={c} /> : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
          {/* Hero */}
          <View style={styles.hero}>
            {/* Tap the avatar to view the photo fullscreen (Telegram-style). */}
            <Pressable onPress={() => avatar && setViewer(true)} disabled={!avatar}>
              <Avatar name={name} src={avatar} size={110} ring palette={c} />
            </Pressable>
            <Text style={styles.heroName}>{name}</Text>
            <View style={styles.onlineRow}>
              <View style={[styles.dot, { backgroundColor: online ? c.online : c.textFaint }]} />
              <Text style={[styles.onlineText, { color: online ? c.online : c.textFaint }]}>
                {online ? t('profile.online') : t('user.offline')}
              </Text>
            </View>
          </View>

          {/* Quick actions (only for other users) */}
          {userId !== myId && (
            <View style={styles.actions}>
              <ActionChip icon="chatbubble" label={t('user.message')} onPress={openChat} styles={styles} c={c} />
              <ActionChip icon="call" label={t('user.call')} onPress={() => openCall(false)} styles={styles} c={c} />
              <ActionChip icon="videocam" label={t('user.video')} onPress={() => openCall(true)} styles={styles} c={c} />
            </View>
          )}

          {/* Info */}
          <Text style={styles.section}>{t('user.info')}</Text>
          <GlassCard padded={false} palette={c}>
            <InfoRow icon="person-outline" label={t('profile.username')} value={`@${name}`} last styles={styles} c={c} />
          </GlassCard>
      </ScrollView>

      {/* Fullscreen avatar viewer */}
      <Modal visible={viewer} transparent animationType="fade" onRequestClose={() => setViewer(false)} statusBarTranslucent>
        <Pressable style={styles.lightbox} onPress={() => setViewer(false)}>
          {avatar ? <Image source={{ uri: fixFileUrl(avatar) }} style={styles.lightboxImg} contentFit="contain" /> : null}
          <View style={[styles.lightboxClose, { top: insets.top + 12 }]}>
            <Ionicons name="close" size={28} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </AuroraBackground>
  );
}

function ActionChip({ icon, label, onPress, styles, c }: { icon: any; label: string; onPress: () => void; styles: S; c: Palette }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
    >
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chipIcon}>
        <Ionicons name={icon} size={20} color={c.ink} />
      </LinearGradient>
      <Text style={styles.chipLabel}>{label}</Text>
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
  iconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', gap: 10, paddingTop: 24, paddingBottom: 8 },
  heroName: { color: c.text, fontFamily: font.display, fontSize: 26, letterSpacing: -0.5 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontFamily: font.bodyMed, fontSize: 14 },

  actions: {
    flexDirection: 'row', justifyContent: 'center', gap: 32,
    paddingVertical: 24,
  },
  chip: { alignItems: 'center', gap: 8 },
  chipIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 12 },

  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '100%', height: '80%' },
  lightboxClose: { position: 'absolute', right: 16 },

  section: {
    color: c.textFaint, fontFamily: font.bodySemi, fontSize: 12,
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 22, marginBottom: 10, marginLeft: 24,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.stroke },
  infoIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  infoValue: { color: c.textDim, fontFamily: font.body, fontSize: 14 },
});
