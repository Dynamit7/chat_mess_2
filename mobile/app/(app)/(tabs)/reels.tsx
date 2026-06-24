import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, RefreshControl,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { reelsApi, storiesApi, ForwardPayload } from '@/lib/api';
import { ForwardSheet } from '@/components/chat/ForwardSheet';
import { groupStories, StoryOwner } from '@/lib/storyGroups';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';
import { font, gradients, Palette } from '@/theme/theme';
import { fixFileUrl } from '@/lib/config';
import { relativeShort } from '@/lib/format';

type Media = { uri: string; name: string; type: string; kind: 'image' | 'video' };
type S = ReturnType<typeof makeStyles>;

// Must match the backend `/api/reels/feed` default `limit` — a page shorter than
// this means we've reached the end and can stop fetching further pages.
const FEED_PAGE_SIZE = 10;

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
  const { c, scheme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const me = Number(user?.userId);
  const meRef = useRef(me); meRef.current = me;

  const [owners, setOwners] = useState<StoryOwner[]>([]);
  const [storiesBusy, setStoriesBusy] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Pagination cursor for the feed (mirrored in a ref so loadMore stays stable).
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const [creating, setCreating] = useState(false);
  const [commentsFor, setCommentsFor] = useState<any | null>(null);
  const [forwardFor, setForwardFor] = useState<any | null>(null);
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
        reelsApi.feed(me, 1).catch(() => []),
        reelsApi.discover(1, me).catch(() => []),
      ]);
      const a = Array.isArray(feed) ? feed : feed?.reels || [];
      const b = Array.isArray(disc) ? disc : disc?.reels || [];
      // Feed carries the per-user fields (isLiked / isFollowing); apply it LAST so
      // it wins over the discover copy of the same post and the heart stays correct.
      const map = new Map<number, any>();
      [...b, ...a].forEach((r) => { if (r && r.id != null) map.set(r.id, r); });
      // Newest first for a feed.
      const merged = [...map.values()].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
      setPosts(merged);
      // Reset the pagination cursor; only the feed endpoint is paginated, so a
      // short first page means there are no further feed pages to fetch.
      pageRef.current = 1;
      setHasMore(a.length >= FEED_PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [me]);

  // Append the next feed page when the user nears the end (infinite scroll), so
  // the feed never loads everything up front. Appends in order (no global
  // re-sort) to keep already-rendered rows from jumping around mid-scroll.
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading || refreshing) return;
    if (!Number.isFinite(me)) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    try {
      const feed = await reelsApi.feed(me, next).catch(() => []);
      const arr = Array.isArray(feed) ? feed : feed?.reels || [];
      if (arr.length < FEED_PAGE_SIZE) setHasMore(false);
      if (arr.length) {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = arr.filter((r: any) => r && r.id != null && !seen.has(r.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        pageRef.current = next;
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, refreshing, me]);

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

  // Handlers are useCallback + receive the post, so each memoized FeedPost keeps
  // stable props and only the affected post re-renders (not the whole feed).
  const toggleLike = useCallback((post: any) => {
    setPosts((prev) => prev.map((r) => r.id === post.id
      ? { ...r, isLiked: !r.isLiked, likesCount: (r.likesCount || 0) + (r.isLiked ? -1 : 1) } : r));
    reelsApi.like(post.id, meRef.current).catch(() => {});
  }, []);
  const follow = useCallback((post: any) => {
    setPosts((prev) => prev.map((r) => r.userId === post.userId ? { ...r, isFollowing: true } : r));
    reelsApi.follow(meRef.current, post.userId).catch(() => {});
  }, []);
  // Open the forward sheet so the post can actually be sent to a chat/group/channel.
  const share = useCallback((post: any) => setForwardFor(post), []);
  const openProfile = useCallback((post: any) => router.push({
    pathname: '/(app)/user/[id]',
    params: { id: String(post.userId), name: post.creator?.username || '', avatar: post.creator?.avatar || '' },
  }), [router]);
  // Called only after the forward succeeds — record the share + bump the counter.
  const onForwarded = (post: any) => {
    setPosts((prev) => prev.map((r) => r.id === post.id ? { ...r, sharesCount: (r.sharesCount || 0) + 1 } : r));
    reelsApi.share(post.id).catch(() => {});
  };
  // Build a forwardable message payload out of a feed post.
  const forwardPayload = (post: any): ForwardPayload => {
    const kind = postKind(post);
    return {
      id: Number(post.id),
      sourceType: 'channel',
      text: post.caption || '',
      type: kind === 'text' ? 'text' : kind,
      fileUrl: kind === 'text' ? null : post.videoUrl || null,
      filename: null,
      senderUsername: post.creator?.username || post.creator?.nickname || 'User',
    };
  };
  const removePost = useCallback((post: any) =>
    Alert.alert(t('feed.deletePost'), t('feed.deletePostConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => {
        setPosts((prev) => prev.filter((r) => r.id !== post.id));
        reelsApi.remove(post.id, meRef.current).catch(() => {});
      } },
    ]), [t]);
  const openComments = useCallback((post: any) => setCommentsFor(post), []);

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
      Alert.alert(t('story.publishFailed'), e?.response?.data?.error || t('story.tryAgain'));
    } finally {
      setStoriesBusy(false);
    }
  };

  const openStory = (ownerIndex: number) => router.push({ pathname: '/(app)/story', params: { start: String(ownerIndex) } });

  return (
    <AuroraBackground palette={c}>
      {focused ? <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /> : null}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{t('tabs.feed')}</Text>
        <Pressable onPress={() => setCreating(true)} style={styles.createBtn} hitSlop={8}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="add" size={22} color={c.ink} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          // Feed posts (esp. videos) are heavy — keep only a few mounted at once.
          windowSize={5}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 24 }}><ActivityIndicator color={c.accent} /></View>
            ) : null
          }
          ListHeaderComponent={
            <StoriesStrip
              owners={owners}
              me={me}
              username={user?.username}
              avatar={user?.avatar}
              busy={storiesBusy}
              onAdd={addStory}
              onOpen={openStory}
              styles={styles}
              c={c}
            />
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 40 }}>
              <EmptyState icon="newspaper-outline" title={t('feed.emptyTitle')} body={t('feed.emptyBody')} palette={c} />
            </View>
          }
          renderItem={({ item }) => (
            <FeedPost
              post={item}
              me={me}
              active={item.id === activeVideoId && focused}
              styles={styles}
              c={c}
              onLike={toggleLike}
              onComment={openComments}
              onShare={share}
              onFollow={follow}
              onDelete={removePost}
              onOpenProfile={openProfile}
            />
          )}
        />
      )}

      {creating && (
        <CreatePost
          me={me}
          username={user?.username}
          avatar={user?.avatar}
          styles={styles}
          c={c}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); setLoading(true); loadPosts(); }}
        />
      )}
      {commentsFor && (
        <ReelComments
          reel={commentsFor}
          me={me}
          styles={styles}
          c={c}
          onClose={() => setCommentsFor(null)}
          onAdded={() => setPosts((prev) => prev.map((r) => r.id === commentsFor.id ? { ...r, commentsCount: (r.commentsCount || 0) + 1 } : r))}
          onRemoved={() => setPosts((prev) => prev.map((r) => r.id === commentsFor.id ? { ...r, commentsCount: Math.max(0, (r.commentsCount || 0) - 1) } : r))}
        />
      )}
      <ForwardSheet
        visible={!!forwardFor}
        userId={me}
        message={forwardFor ? forwardPayload(forwardFor) : null}
        onSent={() => { if (forwardFor) onForwarded(forwardFor); }}
        onClose={() => setForwardFor(null)}
      />
    </AuroraBackground>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stories strip (horizontal rings) — redesigned, compact
// ─────────────────────────────────────────────────────────────────────────────
function StoriesStrip({ owners, me, username, avatar, busy, onAdd, onOpen, styles, c }: {
  owners: StoryOwner[]; me: number; username?: string; avatar?: string; busy: boolean;
  onAdd: () => void; onOpen: (ownerIndex: number) => void; styles: S; c: Palette;
}) {
  const { t } = useT();
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
                <View style={styles.ringInner}><Avatar name={username} src={avatar} size={56} palette={c} /></View>
              </LinearGradient>
            ) : (
              <View style={styles.ringSeen}><Avatar name={username} src={avatar} size={56} palette={c} /></View>
            )}
            <Pressable onPress={onAdd} hitSlop={8} style={styles.addBadge}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="add" size={14} color={c.ink} />
            </Pressable>
          </View>
          <Text numberOfLines={1} style={styles.storyName}>{busy ? t('common.loading') : t('feed.you')}</Text>
        </Pressable>

        {others.map((o) => {
          const idx = owners.findIndex((x) => x.userId === o.userId);
          return (
            <Pressable key={o.userId} style={styles.storyItem} onPress={() => onOpen(idx)}>
              {o.hasUnviewed ? (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                  <View style={styles.ringInner}><Avatar name={o.username} src={o.avatar} size={56} palette={c} /></View>
                </LinearGradient>
              ) : (
                <View style={styles.ringSeen}><Avatar name={o.username} src={o.avatar} size={56} palette={c} /></View>
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
// Memoized: parent passes stable (useCallback) handlers and the same `post`
// reference unless that specific post changed, so only the affected card
// re-renders (a like, an active-video change) instead of the whole feed.
const FeedPost = memo(function FeedPost({ post, me, active, onLike, onComment, onShare, onFollow, onDelete, onOpenProfile, styles, c }: any) {
  const { t } = useT();
  const creator = post.creator || {};
  const isMine = Number(post.userId) === me;
  const kind = postKind(post);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Pressable onPress={() => onOpenProfile(post)}><Avatar name={creator.username} src={creator.avatar} size={46} ring={post.isFollowing} palette={c} /></Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => onOpenProfile(post)}>
          <Text style={styles.authorName} numberOfLines={1}>{creator.username || creator.nickname || 'User'}</Text>
          <Text style={styles.postTime}>{relativeShort(post.createdAt)}</Text>
        </Pressable>
        {!isMine && !post.isFollowing ? (
          <Pressable onPress={() => onFollow(post)} style={styles.followBtn}>
            <Ionicons name="add" size={15} color={c.accent} />
            <Text style={styles.followText}>{t('info.subscribe')}</Text>
          </Pressable>
        ) : null}
        {isMine ? (
          <Pressable onPress={() => onDelete(post)} hitSlop={8} style={styles.moreBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={c.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {post.caption ? (
        <Text style={[styles.caption, kind === 'text' && styles.captionBig]}>{post.caption}</Text>
      ) : null}

      {kind === 'image' ? (
        <Image source={{ uri: fixFileUrl(post.videoUrl) }} style={styles.media} contentFit="cover" transition={150} />
      ) : kind === 'video' ? (
        <VideoPost uri={fixFileUrl(post.videoUrl)} active={active} styles={styles} />
      ) : null}

      {Array.isArray(post.hashtags) && post.hashtags.length > 0 ? (
        <Text style={styles.tags}>{post.hashtags.map((t: string) => `#${t}`).join('  ')}</Text>
      ) : null}

      <View style={styles.actions}>
        <ActionButton icon={post.isLiked ? 'heart' : 'heart-outline'} color={post.isLiked ? c.danger : c.textDim} label={fmt(post.likesCount)} onPress={() => onLike(post)} styles={styles} />
        <ActionButton icon="chatbubble-outline" color={c.textDim} label={fmt(post.commentsCount)} onPress={() => onComment(post)} styles={styles} />
        <ActionButton icon="arrow-redo-outline" color={c.textDim} label={fmt(post.sharesCount)} onPress={() => onShare(post)} styles={styles} />
      </View>
    </View>
  );
});

function ActionButton({ icon, color, label, onPress, styles }: { icon: any; color: string; label: string; onPress: () => void; styles: S }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actBtn, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.actLabel}>{label}</Text>
    </Pressable>
  );
}

const VideoPost = memo(function VideoPost({ uri, active, styles }: { uri: string; active: boolean; styles: S }) {
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
});

// ─────────────────────────────────────────────────────────────────────────────
//  Create post (universal: image / video / text) — prettier modal
// ─────────────────────────────────────────────────────────────────────────────
function CreatePost({ me, username, avatar, onClose, onCreated, styles, c }: {
  me: number; username?: string; avatar?: string; onClose: () => void; onCreated: () => void; styles: S; c: Palette;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
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
      Alert.alert(t('feed.publishFailed'), e?.response?.data?.error || t('story.tryAgain'));
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
            <Pressable hitSlop={8} onPress={onClose}><Text style={styles.sheetCancel}>{t('common.cancel')}</Text></Pressable>
            <Text style={styles.sheetTitle}>{t('feed.newPost')}</Text>
            <View style={{ width: 56 }} />
          </View>

          <View style={styles.composerRow}>
            <Avatar name={username} src={avatar} size={42} palette={c} />
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={t('feed.postPlaceholder')}
              placeholderTextColor={c.textFaint}
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
              <Ionicons name="image-outline" size={22} color={c.accent} />
              <Text style={styles.toolText}>{t('feed.photoVideo')}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Button label={t('feed.publish')} onPress={submit} loading={posting} disabled={!canPost} style={{ paddingHorizontal: 26, height: 46 }} palette={c} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Comments (bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────
function ReelComments({ reel, me, onClose, onAdded, onRemoved, styles, c }: { reel: any; me: number; onClose: () => void; onAdded: () => void; onRemoved: () => void; styles: S; c: Palette }) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // The post owner can moderate (delete) any comment on their post.
  const isOwner = Number(reel.userId) === me;

  useEffect(() => {
    reelsApi.comments(reel.id)
      .then((d: any) => setComments(Array.isArray(d) ? d : d?.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reel.id]);

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      const c2 = await reelsApi.comment(reel.id, me, body);
      setComments((prev) => [...prev, c2?.comment || c2 || { id: Date.now(), text: body, author: { username: 'You' } }]);
      onAdded();
    } catch {
      setText(body);
    }
  };

  const remove = (commentId: number) => {
    Alert.alert(t('feed.deleteComment'), t('feed.deleteCommentConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        setDeletingId(commentId);
        const prev = comments;
        setComments((cs) => cs.filter((x) => Number(x.id) !== commentId));
        try {
          await reelsApi.deleteComment(commentId, me);
          onRemoved();
        } catch {
          setComments(prev); // restore on failure
          Alert.alert(t('feed.deleteFailed'), t('story.tryAgain'));
        } finally {
          setDeletingId(null);
        }
      } },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { alignSelf: 'center', marginBottom: 12 }]}>{t('feed.comments')}</Text>
          {loading ? (
            <View style={{ padding: 30 }}><ActivityIndicator color={c.accent} /></View>
          ) : comments.length === 0 ? (
            <Text style={styles.noComments}>{t('feed.noComments')}</Text>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c2, i) => String(c2.id ?? i)}
              style={{ maxHeight: 340 }}
              renderItem={({ item: cm }) => {
                const author = cm.author || cm.user || {};
                const authorId = Number(author.id ?? cm.userId);
                const canDelete = isOwner || authorId === me;
                const cId = Number(cm.id);
                return (
                  <View style={styles.comment}>
                    <Avatar name={author.username || cm.username} src={author.avatar} size={34} palette={c} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentName}>{author.username || author.nickname || cm.username || 'User'}</Text>
                      <Text style={styles.commentText}>{cm.text}</Text>
                    </View>
                    {canDelete && (
                      <Pressable hitSlop={10} onPress={() => remove(cId)} disabled={deletingId === cId} style={styles.commentDel}>
                        {deletingId === cId
                          ? <ActivityIndicator size="small" color={c.danger} />
                          : <Ionicons name="trash-outline" size={16} color={c.danger} />}
                      </Pressable>
                    )}
                  </View>
                );
              }}
            />
          )}
          <View style={styles.commentComposer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('feed.addComment')}
              placeholderTextColor={c.textFaint}
              style={styles.commentInput}
              multiline
            />
            <Pressable onPress={add} disabled={!text.trim()} style={{ opacity: text.trim() ? 1 : 0.4 }}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
                <Ionicons name="arrow-up" size={20} color={c.ink} />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { color: c.text, fontFamily: font.display, fontSize: 28 },
  createBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  // Stories strip
  storiesWrap: { paddingTop: 4 },
  storiesRow: { paddingHorizontal: 14, gap: 14, paddingBottom: 12 } as any,
  storyItem: { alignItems: 'center', width: 70, gap: 6 },
  ring: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  ringSeen: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: c.stroke2, alignItems: 'center', justifyContent: 'center' },
  addBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: c.bg, overflow: 'hidden' },
  storyName: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 12, textAlign: 'center' },
  stripDivider: { height: 1, backgroundColor: c.stroke, marginHorizontal: 14, marginBottom: 6 },

  // Post card
  card: { backgroundColor: c.glass2, borderWidth: 1, borderColor: c.stroke, borderRadius: 20, marginHorizontal: 12, marginTop: 10, paddingTop: 14, paddingBottom: 6, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, marginBottom: 10 },
  authorName: { color: c.text, fontFamily: font.bodySemi, fontSize: 15 },
  postTime: { color: c.textFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: c.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  followText: { color: c.accent, fontFamily: font.bodySemi, fontSize: 12.5 },
  moreBtn: { paddingHorizontal: 4 },
  caption: { color: c.text, fontFamily: font.body, fontSize: 15, lineHeight: 21, paddingHorizontal: 14, marginBottom: 12 },
  captionBig: { fontSize: 18, lineHeight: 26, fontFamily: font.bodyMed, paddingVertical: 6 },
  media: { width: '100%', aspectRatio: 1, backgroundColor: '#000' },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  muteBtn: { position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  tags: { color: c.accent, fontFamily: font.bodyMed, fontSize: 13.5, paddingHorizontal: 14, paddingTop: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 10 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  actLabel: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 13.5 },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: c.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.stroke, paddingHorizontal: 16, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.stroke2, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetCancel: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 15 },
  sheetTitle: { color: c.text, fontFamily: font.bodySemi, fontSize: 17 },
  composerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  captionInput: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, lineHeight: 22, minHeight: 80, maxHeight: 180, paddingTop: 8, textAlignVertical: 'top' },
  preview: { height: 200, borderRadius: 16, overflow: 'hidden', marginTop: 12, backgroundColor: '#000' },
  previewVideo: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewVideoText: { color: '#fff', fontFamily: font.bodyMed, fontSize: 13, paddingHorizontal: 20 },
  previewRemove: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingRight: 12 },
  toolText: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 14 },

  // Comments
  noComments: { color: c.textFaint, fontFamily: font.body, fontSize: 14, textAlign: 'center', paddingVertical: 26 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 9 },
  commentName: { color: c.text, fontFamily: font.bodySemi, fontSize: 13.5 },
  commentText: { color: c.textDim, fontFamily: font.body, fontSize: 14, marginTop: 2, lineHeight: 20 },
  commentDel: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.stroke, marginTop: 6 },
  commentInput: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 15, maxHeight: 100, backgroundColor: c.glass, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: c.stroke },
  send: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
