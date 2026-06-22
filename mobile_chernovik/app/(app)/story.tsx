import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { storiesApi } from '@/lib/api';
import { groupStories, StoryOwner } from '@/lib/storyGroups';
import { useAuth } from '@/state/auth';
import { colors, font } from '@/theme/theme';
import { fixFileUrl } from '@/lib/config';
import { relativeShort } from '@/lib/format';

const { width: W, height: H } = Dimensions.get('window');
const IMG_MS = 5000;

export default function StoryViewer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const me = Number(user?.userId);
  const { start } = useLocalSearchParams<{ start: string }>();

  const [owners, setOwners] = useState<StoryOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [oi, setOi] = useState(Number(start) || 0);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const player = useVideoPlayer(null, (p) => { p.loop = false; });
  const rafStart = useRef(0);
  const rafId = useRef<number | null>(null);

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)')), [router]);

  useEffect(() => {
    let alive = true;
    storiesApi.personalized(me)
      .then((data: any) => { if (!alive) return; const g = groupStories(Array.isArray(data) ? data : [], me, user?.username || 'You', new Set()); setOwners(g); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [me]);

  const owner = owners[oi];
  const story = owner?.stories[si];
  const isOwn = owner && Number(owner.userId) === me;
  const isVideo = story?.type === 'video';

  const next = useCallback(() => {
    setSi((cur) => {
      const stories = owners[oi]?.stories || [];
      if (cur < stories.length - 1) return cur + 1;
      if (oi < owners.length - 1) { setOi(oi + 1); return 0; }
      close();
      return cur;
    });
  }, [oi, owners, close]);

  const prev = useCallback(() => {
    setSi((cur) => {
      if (cur > 0) return cur - 1;
      if (oi > 0) { const po = owners[oi - 1]; setOi(oi - 1); return Math.max(0, (po?.stories.length || 1) - 1); }
      return 0;
    });
  }, [oi, owners]);

  // Mark viewed + load media when story changes.
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    rafStart.current = 0;
    if (!isOwn) storiesApi.view(story.id, me).catch(() => {});
    if (isVideo) { try { player.replace(fixFileUrl(story.fileUrl)); player.play(); } catch {} }
    else player.pause();
  }, [story?.id]);

  // Progress timer (images: fixed; video: by player duration).
  useEffect(() => {
    if (!story) return;
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      if (!paused) {
        const dur = isVideo ? Math.max(2000, (player.duration || 0) * 1000 || 15000) : IMG_MS;
        rafStart.current += now - last;
        const p = Math.min(1, rafStart.current / dur);
        setProgress(p);
        if (p >= 1) { next(); return; }
      }
      last = now;
      rafId.current = requestAnimationFrame(loop) as unknown as number;
    };
    rafId.current = requestAnimationFrame(loop) as unknown as number;
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [story?.id, paused, isVideo, next, player]);

  useEffect(() => { player.muted = false; }, [player]);

  const removeStory = () => {
    if (!story) return;
    Alert.alert('Delete story', 'Remove this story?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        storiesApi.remove(story.id, me).catch(() => {});
        setOwners((prev) => prev.map((o) => o.userId === owner!.userId ? { ...o, stories: o.stories.filter((s) => s.id !== story.id) } : o).filter((o) => o.stories.length));
        next();
      } },
    ]);
  };

  if (loading) return <View style={styles.full}><ActivityIndicator color={colors.accent} /></View>;
  if (!owner || !story) return <View style={styles.full}><Text style={styles.gone}>No stories to show.</Text><Pressable onPress={close} style={styles.closeBtnCenter}><Text style={styles.closeText}>Close</Text></Pressable></View>;

  return (
    <View style={styles.full}>
      {isVideo ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      ) : (
        <Image source={{ uri: fixFileUrl(story.fileUrl) }} style={StyleSheet.absoluteFill} contentFit="contain" />
      )}

      {/* progress bars */}
      <View style={[styles.bars, { top: insets.top + 8 }]}>
        {owner.stories.map((s, i) => (
          <View key={s.id} style={styles.barTrack}>
            <View style={[styles.barFill, { width: i < si ? '100%' : i === si ? `${progress * 100}%` : '0%' }]} />
          </View>
        ))}
      </View>

      {/* header */}
      <View style={[styles.head, { top: insets.top + 20 }]}>
        <Avatar name={owner.username} src={owner.avatar} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headName}>{isOwn ? 'Your story' : owner.username}</Text>
          <Text style={styles.headTime}>{relativeShort(story.createdAt)}</Text>
        </View>
        {isOwn ? <Pressable hitSlop={8} onPress={removeStory}><Ionicons name="trash-outline" size={22} color="#fff" /></Pressable> : null}
        <Pressable hitSlop={8} onPress={close}><Ionicons name="close" size={28} color="#fff" /></Pressable>
      </View>

      {/* tap zones */}
      <Pressable style={styles.tapPrev} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={150} />
      <Pressable style={styles.tapNext} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} delayLongPress={150} />

      {story.caption ? (
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={[styles.captionWrap, { paddingBottom: insets.bottom + 24 }]} pointerEvents="none">
          <Text style={styles.caption}>{story.caption}</Text>
        </LinearGradient>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  gone: { color: '#fff', fontFamily: font.body, fontSize: 15 },
  bars: { position: 'absolute', left: 10, right: 10, flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  head: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headName: { color: '#fff', fontFamily: font.bodySemi, fontSize: 14 },
  headTime: { color: 'rgba(255,255,255,0.7)', fontFamily: font.mono, fontSize: 11, marginTop: 1 },
  tapPrev: { position: 'absolute', left: 0, top: 80, bottom: 80, width: W * 0.33 },
  tapNext: { position: 'absolute', right: 0, top: 80, bottom: 80, width: W * 0.67 },
  captionWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 60, justifyContent: 'flex-end' },
  caption: { color: '#fff', fontFamily: font.body, fontSize: 15.5, lineHeight: 22 },
  closeBtnCenter: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  closeText: { color: '#fff', fontFamily: font.bodySemi },
});
