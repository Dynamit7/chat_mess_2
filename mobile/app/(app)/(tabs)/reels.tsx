import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, RefreshControl,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { reelsApi, storiesApi } from '@/lib/api';
import { groupStories, StoryOwner } from '@/lib/storyGroups';
import { useAuth } from '@/state/auth';
import { colors, font, gradients } from '@/theme/theme';
import { fixFileUrl } from '@/lib/config';
import { relativeShort } from '@/lib/format';

type Media = { uri: string; name: string; type: string; kind: 'image' | 'video' };

const fmt = (n: number) => {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
};

const postKind = (p: any): 'image' | 'video' | 'text' => {
  if (p?.mediaType === 'image' || p?.mediaType === 'video' || p?.mediaType === 'text') return p.mediaType;
  return p?.videoUrl ? 'video' : 'text';
};

// ═══════════════════════════════════════════════════════════════════════════
//  FEED SCREEN — LinkedIn-style universal feed (image / video / text) + stories
// ═══════════════════════════════════════════════════════════════════════════
export default function FeedScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const me = Number(user?.userId);
  const meRef = useRef(me); meRef.current = me;

  const [owners, setOwners] = useState<StoryOwner[]>([]);
  const [storiesBusy, setStoriesBusy] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [commentsFor, setCommentsFor] = useState<any | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
  const [focused, setFocused] = useState(true);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const loadStories = useCallback(() => {
    if (!Number.isFinite(me)) return; // wait for the session before calling the API
    storiesApi.personalized(me)
      .then((data: any) => setOwners(groupStories(Array.isArray(data) ? data : [], me, user?.username || 'You', new Set())))
      .catch(() => {});
  }, [me, user?.username]);

  const loadPosts = useCallback(async () => {
    if (!Number.isFinite(me)) return; // wait for the session before calling the API
    try {
      const [feed, disc] = await Promise.all([
        reelsApi.feed(me).catch(() => []),
        reelsApi.discover().catch(() => []),
      ]);
      const a = Array.isArray(feed) ? feed : feed?.reels || [];
      const b = Array.isArray(disc) ? disc : disc?.reels || [];
      const map = new Map<number, any>();
      [...a, ...b].forEach((r) => { if (r && r.id != null) map.set(r.id, r); });
      // Newest first for a feed.
      const merged = [...map.values()].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      setPosts(merged);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => { loadStories(); loadPosts(); }, [loadStories, loadPosts]);

  // Refresh stories/feed whenever the tab regains focus (e.g. after creating).
  useFocusEffect(useCallback(() => { loadStories(); }, [loadStories]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStories(), loadPosts()]);
    setRefreshing(false);
  }, [loadStories, loadPosts]);

  const onViewable = useRef(({ viewableItems }: any) => {
    const first = viewableItems?.[0]?.item;
    if (first?.id != null) {
      setActiveVideoId(postKind(first) === 'video' ? first.id : null);
      reelsApi.view(first.id, meRef.current).catch(() => {});
    }
  }).current;
  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const toggleLike = (post: any) => {
    setPosts((prev) => prev.map((r) => r.id === post.id
      ? { ...r, isLiked: !r.isLiked, likesCount: (r.likesCount || 0) + (r.isLiked ? -1 : 1) } : r));
    reelsApi.like(post.id, me).catch(() => {});
  };
  const follow = (post: any) => {
    setPosts((prev) => prev.map((r) => r.userId === post.userId ? { ...r, isFollowing: true } : r));
    reelsApi.follow(me, post.userId).catch(() => {});
  };
  const share = (post: any) => {
    setPosts((prev) => prev.map((r) => r.id === post.id ? { ...r, sharesCount: (r.sharesCount || 0) + 1 } : r));
    reelsApi.share(post.id).catch(() => {});
  };
  const removePost = (post: any) =>
    Alert.alert('Удалить пост', 'Удалить эту публикацию?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => {
        setPosts((prev) => prev.filter((r) => r.id !== post.id));
        reelsApi.remove(post.id, me).catch(() => {});
      } },
    ]);

  // Multi-select story upload — pick several photos/videos at once.
  const addStory = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'], quality: 0.85, allowsMultipleSelection: true, selectionLimit: 10,
    });
    if (res.canceled || !res.assets?.length) return;
    setStoriesBusy(true);
    try {
      for (const a of res.assets) {
        await storiesApi.create({
          userId: me,
          file: { uri: a.uri, name: a.fileName || 'story', type: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg') },
        });
      }
      loadStories();
    } catch (e: any) {
      Alert.alert('Не удалось опубликовать историю', e?.response?.data?.error || 'Попробуйте ещё раз.');
    } finally {
      setStoriesBusy(false);
    }
  };

  const openStory = (ownerIndex: number) => router.push({ pathname: '/(app)/story', params: { start: String(ownerIndex) } });

  return (
    <AuroraBackground>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Лента</Text>
        <Pressable onPress={() => setCreating(true)} style={styles.createBtn} hitSlop={8}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="add" size={22} color={colors.ink} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewConfig}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          ListHeaderComponent={
            <StoriesStrip
              owners={owners}
              me={me}
              username={user?.username}
              avatar={user?.avatar}
              busy={storiesBusy}
              onAdd={addStory}
              onOpen={openStory}
            />
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 40 }}>
              <EmptyState icon="newspaper-outline" title="Пока пусто" body="Поделитесь первым постом — фото, видео или мыслями." />
            </View>
          }
          renderItem={({ item }) => (
            <FeedPost
              post={item}
              me={me}
              active={item.id === activeVideoId && focused}
              onLike={() => toggleLike(item)}
              onComment={() => setCommentsFor(item)}
              onShare={() => share(item)}
              onFollow={() => follow(item)}
              onDelete={() => removePost(item)}
              onOpenProfile={() => router.push({ pathname: '/(app)/user/[id]', params: { id: String(item.userId), name: item.creator?.username || '', avatar: item.creator?.avatar || '' } })}
            />
          )}
        />
      )}

      {creating && (
        <CreatePost
          me={me}
          username={user?.username}
          avatar={user?.avatar}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); setLoading(true); loadPosts(); }}
        />
      )}
      {commentsFor && (
        <ReelComments
          reel={commentsFor}
          me={me}
          onClose={() => setCommentsFor(null)}
          onAdded={() => setPosts((prev) => prev.map((r) => r.id === commentsFor.id ? { ...r, commentsCount: (r.commentsCount || 0) + 1 } : r))}
        />
      )}
    </AuroraBackground>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stories strip (horizontal rings) — redesigned, compact
// ─────────────────────────────────────────────────────────────────────────────
function StoriesStrip({ owners, me, username, avatar, busy, onAdd, onOpen }: {
  owners: StoryOwner[]; me: number; username?: string; avatar?: string; busy: boolean;
  onAdd: () => void; onOpen: (ownerIndex: number) => void;
}) {
  const mine = owners.find((o) => o.userId === me);
  const others = owners.filter((o) => o.userId !== me);
  const mineIndex = owners.findIndex((o) => o.userId === me);

  return (
    <View style={styles.storiesWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
        {/* Your story */}
        <Pressable style={styles.storyItem} onPress={mine ? () => onOpen(mineIndex) : onAdd}>
          <View>
            {mine ? (
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                <View style={styles.ringInner}><Avatar name={username} src={avatar} size={56} /></View>
              </LinearGradient>
            ) : (
              <View style={styles.ringSeen}><Avatar name={username} src={avatar} size={56} /></View>
            )}
            <Pressable onPress={onAdd} hitSlop={8} style={styles.addBadge}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="add" size={14} color={colors.ink} />
            </Pressable>
          </View>
          <Text numberOfLines={1} style={styles.storyName}>{busy ? 'Загрузка…' : 'Вы'}</Text>
        </Pressable>

        {others.map((o) => {
          const idx = owners.findIndex((x) => x.userId === o.userId);
          return (
            <Pressable key={o.userId} style={styles.storyItem} onPress={() => onOpen(idx)}>
              {o.hasUnviewed ? (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                  <View style={styles.ringInner}><Avatar name={o.username} src={o.avatar} size={56} /></View>
                </LinearGradient>
              ) : (
                <View style={styles.ringSeen}><Avatar name={o.username} src={o.avatar} size={56} /></View>
              )}
              <Text numberOfLines={1} style={styles.storyName}>{o.username}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.stripDivider} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Feed post card
// ─────────────────────────────────────────────────────────────────────────────
function FeedPost({ post, me, active, onLike, onComment, onShare, onFollow, onDelete, onOpenProfile }: any) {
  const creator = post.creator || {};
  const isMine = Number(post.userId) === me;
  const kind = postKind(post);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Pressable onPress={onOpenProfile}><Avatar name={creator.username} src={creator.avatar} size={46} ring={post.isFollowing} /></Pressable>
        <Pressable style={{ flex: 1 }} onPress={onOpenProfile}>
          <Text style={styles.authorName} numberOfLines={1}>{creator.username || creator.nickname || 'User'}</Text>
          <Text style={styles.postTime}>{relativeShort(post.createdAt)}</Text>
        </Pressable>
        {!isMine && !post.isFollowing ? (
          <Pressable onPress={onFollow} style={styles.followBtn}>
            <Ionicons name="add" size={15} color={colors.accent} />
            <Text style={styles.followText}>Подписаться</Text>
          </Pressable>
        ) : null}
        {isMine ? (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.moreBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {post.caption ? (
        <Text style={[styles.caption, kind === 'text' && styles.captionBig]}>{post.caption}</Text>
      ) : null}

      {kind === 'image' ? (
        <Image source={{ uri: fixFileUrl(post.videoUrl) }} style={styles.media} contentFit="cover" transition={150} />
      ) : kind === 'video' ? (
        <VideoPost uri={fixFileUrl(post.videoUrl)} active={active} />
      ) : null}

      {Array.isArray(post.hashtags) && post.hashtags.length > 0 ? (
        <Text style={styles.tags}>{post.hashtags.map((t: string) => `#${t}`).join('  ')}</Text>
      ) : null}

      <View style={styles.actions}>
        <ActionButton icon={post.isLiked ? 'heart' : 'heart-outline'} color={post.isLiked ? colors.danger : colors.textDim} label={fmt(post.likesCount)} onPress={onLike} />
        <ActionButton icon="chatbubble-outline" color={colors.textDim} label={fmt(post.commentsCount)} onPress={onComment} />
        <ActionButton icon="arrow-redo-outline" color={colors.textDim} label={fmt(post.sharesCount)} onPress={onShare} />
      </View>
    </View>
  );
}

function ActionButton({ icon, color, label, onPress }: { icon: any; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actBtn, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.actLabel}>{label}</Text>
    </Pressable>
  );
}

function VideoPost({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
  }, [active, paused, player]);
  useEffect(() => { player.muted = muted; }, [muted, player]);

  return (
    <Pressable style={styles.media} onPress={() => setPaused((p) => !p)}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {paused ? (
        <View style={[styles.playOverlay, { pointerEvents: 'none' }]}><Ionicons name="play" size={56} color="rgba(255,255,255,0.92)" /></View>
      ) : null}
      <Pressable style={styles.muteBtn} onPress={() => setMuted((m) => !m)} hitSlop={8}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
      </Pressable>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Create post (universal: image / video / text) — prettier modal
// ─────────────────────────────────────────────────────────────────────────────
function CreatePost({ me, username, avatar, onClose, onCreated }: {
  me: number; username?: string; avatar?: string; onClose: () => void; onCreated: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState<Media | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const kind: 'image' | 'video' = a.type === 'video' || a.mimeType?.startsWith('video/') ? 'video' : 'image';
    setMedia({ uri: a.uri, name: a.fileName || `post_${Date.now()}`, type: a.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'), kind });
  };

  const canPost = !!caption.trim() || !!media;
  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      const cap = caption.trim();
      const tags = cap.match(/#(\w+)/g)?.map((t) => t.slice(1)) || [];
      const mediaType = media ? media.kind : 'text';
      await reelsApi.create({
        userId: me,
        caption: cap,
        hashtags: tags,
        mediaType,
        media: media ? { uri: media.uri, name: media.name, type: media.type } : undefined,
      });
      onCreated();
    } catch (e: any) {
      Alert.alert('Не удалось опубликовать', e?.response?.data?.error || 'Попробуйте ещё раз.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Pressable hitSlop={8} onPress={onClose}><Text style={styles.sheetCancel}>Отмена</Text></Pressable>
            <Text style={styles.sheetTitle}>Новый пост</Text>
            <View style={{ width: 56 }} />
          </View>

          <View style={styles.composerRow}>
            <Avatar name={username} src={avatar} size={42} />
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Поделитесь чем-нибудь…"
              placeholderTextColor={colors.textFaint}
              style={styles.captionInput}
              multiline
              autoFocus
            />
          </View>

          {media ? (
            <View style={styles.preview}>
              {media.kind === 'image' ? (
                <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.previewVideo]}>
                  <Ionicons name="videocam" size={34} color="#fff" />
                  <Text style={styles.previewVideoText} numberOfLines={1}>{media.name}</Text>
                </View>
              )}
              <Pressable style={styles.previewRemove} onPress={() => setMedia(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.toolbar}>
            <Pressable style={styles.toolBtn} onPress={pick}>
              <Ionicons name="image-outline" size={22} color={colors.accent} />
              <Text style={styles.toolText}>Фото / Видео</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Button label="Опубликовать" onPress={submit} loading={posting} disabled={!canPost} style={{ paddingHorizontal: 26, height: 46 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Comments (bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────
function ReelComments({ reel, me, onClose, onAdded }: { reel: any; me: number; onClose: () => void; onAdded: () => void }) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');

  useEffect(() => {
    reelsApi.comments(reel.id)
      .then((d: any) => setComments(Array.isArray(d) ? d : d?.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reel.id]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      const c = await reelsApi.comment(reel.id, me, t);
      setComments((prev) => [...prev, c?.comment || c || { id: Date.now(), text: t, user: { username: 'You' } }]);
      onAdded();
    } catch {
      setText(t);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { alignSelf: 'center', marginBottom: 12 }]}>Комментарии</Text>
          {loading ? (
            <View style={{ padding: 30 }}><ActivityIndicator color={colors.accent} /></View>
          ) : comments.length === 0 ? (
            <Text style={styles.noComments}>Пока нет комментариев.</Text>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c, i) => String(c.id ?? i)}
              style={{ maxHeight: 340 }}
              renderItem={({ item: c }) => (
                <View style={styles.comment}>
                  <Avatar name={c.user?.username || c.username} src={c.user?.avatar} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentName}>{c.user?.username || c.username || 'User'}</Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                </View>
              )}
            />
          )}
          <View style={styles.commentComposer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Добавить комментарий…"
              placeholderTextColor={colors.textFaint}
              style={styles.commentInput}
              multiline
            />
            <Pressable onPress={add} disabled={!text.trim()} style={{ opacity: text.trim() ? 1 : 0.4 }}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
                <Ionicons name="arrow-up" size={20} color={colors.ink} />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { color: colors.text, fontFamily: font.display, fontSize: 28 },
  createBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  // Stories strip
  storiesWrap: { paddingTop: 4 },
  storiesRow: { paddingHorizontal: 14, gap: 14, paddingBottom: 12 } as any,
  storyItem: { alignItems: 'center', width: 70, gap: 6 },
  ring: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  ringSeen: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: colors.stroke2, alignItems: 'center', justifyContent: 'center' },
  addBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.bg, overflow: 'hidden' },
  storyName: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 12, textAlign: 'center' },
  stripDivider: { height: 1, backgroundColor: colors.stroke, marginHorizontal: 14, marginBottom: 6 },

  // Post card
  card: { backgroundColor: colors.glass2, borderWidth: 1, borderColor: colors.stroke, borderRadius: 20, marginHorizontal: 12, marginTop: 10, paddingTop: 14, paddingBottom: 6, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, marginBottom: 10 },
  authorName: { color: colors.text, fontFamily: font.bodySemi, fontSize: 15 },
  postTime: { color: colors.textFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  followText: { color: colors.accent, fontFamily: font.bodySemi, fontSize: 12.5 },
  moreBtn: { paddingHorizontal: 4 },
  caption: { color: colors.text, fontFamily: font.body, fontSize: 15, lineHeight: 21, paddingHorizontal: 14, marginBottom: 12 },
  captionBig: { fontSize: 18, lineHeight: 26, fontFamily: font.bodyMed, paddingVertical: 6 },
  media: { width: '100%', aspectRatio: 1, backgroundColor: '#000' },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  muteBtn: { position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  tags: { color: colors.accent, fontFamily: font.bodyMed, fontSize: 13.5, paddingHorizontal: 14, paddingTop: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 10 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  actLabel: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 13.5 },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.stroke, paddingHorizontal: 16, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.stroke2, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetCancel: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 15 },
  sheetTitle: { color: colors.text, fontFamily: font.bodySemi, fontSize: 17 },
  composerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  captionInput: { flex: 1, color: colors.text, fontFamily: font.body, fontSize: 16, lineHeight: 22, minHeight: 80, maxHeight: 180, paddingTop: 8, textAlignVertical: 'top' },
  preview: { height: 200, borderRadius: 16, overflow: 'hidden', marginTop: 12, backgroundColor: '#000' },
  previewVideo: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewVideoText: { color: '#fff', fontFamily: font.bodyMed, fontSize: 13, paddingHorizontal: 20 },
  previewRemove: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingRight: 12 },
  toolText: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 14 },

  // Comments
  noComments: { color: colors.textFaint, fontFamily: font.body, fontSize: 14, textAlign: 'center', paddingVertical: 26 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 9 },
  commentName: { color: colors.text, fontFamily: font.bodySemi, fontSize: 13.5 },
  commentText: { color: colors.textDim, fontFamily: font.body, fontSize: 14, marginTop: 2, lineHeight: 20 },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.stroke, marginTop: 6 },
  commentInput: { flex: 1, color: colors.text, fontFamily: font.body, fontSize: 15, maxHeight: 100, backgroundColor: colors.glass, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.stroke },
  send: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
