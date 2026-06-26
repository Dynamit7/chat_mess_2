import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Platform,
  TextInput, Alert, Modal,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SelectionBar } from '@/components/ui/SelectionBar';
import { useSelection } from '@/lib/useSelection';
import { getDraft, writeDraft, commitDraft } from '@/lib/drafts';
import { channelsApi } from '@/lib/api';
import { cacheGet, cacheSet, cacheKeys } from '@/lib/offlineCache';
import { getIsOnline } from '@/lib/net';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuth } from '@/state/auth';
import { useSocket } from '@/state/socket';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';
import { font, gradients, radius, shadow, Palette } from '@/theme/theme';
import { timeOf, relativeShort } from '@/lib/format';
import { fixFileUrl } from '@/lib/config';

const QUICK = ['❤️', '🔥', '👍', '😂', '😮', '🙏'];
const PAGE_SIZE = 40;

type Post = any;
type RMap = Record<number, Record<string, { count: number; users: number[] }>>;

export default function ChannelFeed() {
  const { user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{ id: string; name: string; avatar: string; ownerId: string; isMember: string; members: string }>();
  const me = Number(user?.userId);
  const channelId = Number(params.id);
  const [channelName, setChannelName] = useState(params.name || 'Channel');
  const [channelAvatar, setChannelAvatar] = useState(params.avatar || '');
  const canManage = Number(params.ownerId) === me;

  const [posts, setPosts] = useState<Post[]>([]);
  const [reactions, setReactions] = useState<RMap>({});
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<number | null>(null); // id of the oldest loaded post
  const loadingOlderRef = useRef(false);
  const [member, setMember] = useState(params.isMember !== 'false');
  const [joining, setJoining] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const sel = useSelection<number>();

  const listRef = useRef<FlatList<Post>>(null);
  // Inverted list: the newest post sits at offset 0 (the visual bottom).
  const scrollToEnd = () => requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));

  // Draft for the post composer (owners only).
  const draftKey = canManage && Number.isFinite(me) ? `draft.${me}.channel.${channelId}` : null;
  const textRef = useRef('');
  textRef.current = text;
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!draftKey) return;
    let alive = true;
    getDraft(draftKey).then((d) => { if (alive && d) setText(d); });
    return () => { alive = false; commitDraft(draftKey, textRef.current); };
  }, [draftKey]);

  const onChangeText = (v: string) => {
    setText(v);
    if (!draftKey) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => writeDraft(draftKey, v), 350);
  };

  // Fetch reaction maps for a batch of posts and merge them into state.
  const loadReactions = useCallback((batch: Post[], alive: () => boolean = () => true) =>
    Promise.all(batch.map((p: Post) => channelsApi.reactions(p.id).then((r: any) => [p.id, r]).catch(() => [p.id, {}])))
      .then((pairs) => { if (alive()) setReactions((prev) => ({ ...Object.fromEntries(pairs), ...prev })); }), []);

  // Load an older page when the user scrolls to the top of the feed. Inverted
  // list: older posts are prepended to the chronological `posts` array, keeping
  // the scroll position stable.
  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMore || cursorRef.current == null) return;
    if (!(await getIsOnline())) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await channelsApi.messagesPage(channelId, PAGE_SIZE, cursorRef.current);
      const older = Array.isArray(page?.messages) ? page.messages : [];
      let fresh: Post[] = [];
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => Number(p.id)));
        fresh = older.filter((p) => !seen.has(Number(p.id)));
        return fresh.length ? [...fresh, ...prev] : prev;
      });
      setHasMore(!!page?.hasMore);
      cursorRef.current = page?.nextBefore ?? (older.length ? Number(older[0].id) : null);
      if (fresh.length) loadReactions(fresh);
    } catch {
      // keep cursor; user can retry by scrolling again
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasMore, channelId, loadReactions]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    cursorRef.current = null;
    loadingOlderRef.current = false;
    setHasMore(false);
    setLoadingOlder(false);
    socket.emit('joinChannel', { channelId, userId: me });
    socket.emit('joinRoom', `channel_${channelId}`);
    // Cache-first (Telegram-style): paint cached posts instantly so re-opening a
    // channel never flashes a spinner, then reconcile with the server in the
    // background. Spinner only shows on a true cold open (no cache yet).
    const key = cacheKeys.channelMessages(channelId);
    // Fire-and-forget cache paint — must NOT block the network path: SQLite is
    // unavailable on web and `cacheGet` would otherwise hang the whole load
    // forever (perpetual spinner). Never clobber a fresh network result.
    cacheGet<Post[]>(key).then((cached) => {
      if (alive && cached?.length) {
        setPosts((prev) => (prev.length ? prev : cached));
        setLoading(false);
      }
    }).catch(() => {});
    (async () => {
      if (!(await getIsOnline())) {
        // Offline: rely on the cache paint above; just clear the spinner.
        if (alive) { setHasMore(false); setLoading(false); }
        return;
      }
      try {
        const page = await channelsApi.messagesPage(channelId, PAGE_SIZE);
        if (!alive) return;
        const arr = Array.isArray(page?.messages) ? page.messages : [];
        setPosts(arr);
        setHasMore(!!page?.hasMore);
        cursorRef.current = page?.nextBefore ?? (arr.length ? Number(arr[0].id) : null);
        setLoading(false);
        cacheSet(key, arr.slice(-50));
        loadReactions(arr, () => alive);
      } catch {
        if (alive) { setHasMore(false); setLoading(false); }
      }
    })();
    channelsApi.updateLastSeen(channelId, me).catch(() => {});
    return () => { alive = false; };
  }, [channelId]);

  useEffect(() => {
    const onMsg = (m: any) => {
      if (Number(m.channelId) !== channelId) return;
      if (m.parentMessageId) {
        setPosts((prev) => prev.map((p) => (Number(p.id) === Number(m.parentMessageId) ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p)));
        return;
      }
      setPosts((prev) => (prev.some((p) => Number(p.id) === Number(m.id)) ? prev : [...prev, m]));
      scrollToEnd();
    };
    const onDeleted = ({ messageId }: any) => setPosts((prev) => prev.filter((p) => Number(p.id) !== Number(messageId)));
    const onUpdated = ({ channelId: cid, updatedFields }: any) => {
      if (Number(cid) !== channelId) return;
      if (updatedFields?.name) setChannelName(updatedFields.name);
      if (updatedFields?.avatar) setChannelAvatar(updatedFields.avatar);
    };
    const reaction = (add: boolean) => ({ messageId, userId, emoji }: any) => {
      setReactions((prev) => {
        const map = { ...(prev[messageId] || {}) };
        const cur = map[emoji] ? { ...map[emoji], users: [...(map[emoji].users || [])] } : { count: 0, users: [] };
        const has = cur.users.includes(Number(userId));
        if (add && !has) { cur.users.push(Number(userId)); cur.count = cur.users.length; map[emoji] = cur; }
        if (!add && has) { cur.users = cur.users.filter((u) => u !== Number(userId)); cur.count = cur.users.length; if (!cur.count) delete map[emoji]; else map[emoji] = cur; }
        return { ...prev, [messageId]: map };
      });
    };
    const added = reaction(true), removed = reaction(false);
    socket.on('channelMessageReceived', onMsg);
    socket.on('channelMessageDeleted', onDeleted);
    socket.on('channelUpdated', onUpdated);
    socket.on('reactionAdded', added);
    socket.on('reactionRemoved', removed);
    return () => {
      socket.off('channelMessageReceived', onMsg);
      socket.off('channelMessageDeleted', onDeleted);
      socket.off('channelUpdated', onUpdated);
      socket.off('reactionAdded', added);
      socket.off('reactionRemoved', removed);
    };
  }, [socket, channelId]);

  const publish = async () => {
    const t = text.trim();
    if (!t) return;
    setPosting(true);
    setText('');
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (draftKey) commitDraft(draftKey, '');
    try {
      const post = await channelsApi.post(channelId, { userId: me, text: t });
      setPosts((prev) => (prev.some((p) => Number(p.id) === Number(post.id)) ? prev : [...prev, post]));
      scrollToEnd();
    } catch (e: any) {
      setText(t);
      Alert.alert('Could not post', e?.response?.data?.error || 'Try again.');
    } finally {
      setPosting(false);
    }
  };

  const publishImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setPosting(true);
    try {
      const post = await channelsApi.post(channelId, { userId: me, text: '', file: { uri: a.uri, name: a.fileName || 'media', type: a.mimeType || 'image/jpeg' } });
      setPosts((prev) => (prev.some((p) => Number(p.id) === Number(post.id)) ? prev : [...prev, post]));
      scrollToEnd();
    } catch { Alert.alert('Upload failed', 'Try a smaller file.'); }
    finally { setPosting(false); }
  };

  const react = (post: Post, emoji: string) => channelsApi.react(channelId, post.id, me, emoji).catch(() => {});
  const openReactPicker = (post: Post) =>
    Alert.alert('React', undefined, [...QUICK.map((e) => ({ text: e, onPress: () => react(post, e) })), { text: 'Cancel', style: 'cancel' }]);
  const deletePost = (post: Post) =>
    Alert.alert('Delete post', 'Remove this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { setPosts((prev) => prev.filter((p) => Number(p.id) !== Number(post.id))); channelsApi.deleteMessage(channelId, post.id, me).catch(() => {}); } },
    ]);

  const selectableIds = canManage ? posts.map((p) => Number(p.id)) : [];
  const deleteSelected = () => {
    const ids = [...sel.selected];
    if (ids.length === 0) return;
    Alert.alert(t('feed.deletePostsTitle'), t('feed.deletePostsConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const idSet = new Set(ids);
          setPosts((prev) => prev.filter((p) => !idSet.has(Number(p.id))));
          ids.forEach((id) => channelsApi.deleteMessage(channelId, id, me).catch(() => {}));
          sel.exit();
        },
      },
    ]);
  };

  const join = async () => {
    setJoining(true);
    try { await channelsApi.join(channelId, me); setMember(true); }
    catch (e: any) { Alert.alert('Could not subscribe', e?.response?.data?.error || 'Try again.'); }
    finally { setJoining(false); }
  };

  const renderPost = ({ item: p }: { item: Post }) => {
    const rmap = reactions[p.id] || {};
    const rlist = Object.entries(rmap);
    const isImage = p.type === 'image' && p.fileUrl;
    const selected = sel.isSelected(Number(p.id));
    return (
      <Pressable
        style={[styles.card, selected && styles.cardSelected]}
        onLongPress={canManage ? () => sel.enter(Number(p.id)) : undefined}
        delayLongPress={220}
        onPress={sel.active ? () => sel.toggle(Number(p.id)) : undefined}
      >
        <View style={styles.cardHead}>
          {sel.active ? (
            <View style={[styles.checkbox, selected && styles.checkboxOn]}>
              {selected ? <Ionicons name="checkmark" size={14} color={c.ink} /> : null}
            </View>
          ) : null}
          <Avatar name={p.sender?.username || channelName} src={p.sender?.avatar || params.avatar} size={36} palette={c} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{channelName}</Text>
            <Text style={styles.cardTime}>{relativeShort(p.createdAt)} · {timeOf(p.createdAt)}</Text>
          </View>
          {canManage && !sel.active ? (
            <Pressable hitSlop={8} onPress={() => deletePost(p)}><Ionicons name="ellipsis-horizontal" size={18} color={c.textFaint} /></Pressable>
          ) : null}
        </View>

        {isImage ? (
          <Pressable onPress={() => setLightbox(fixFileUrl(p.fileUrl))}>
            <Image source={{ uri: fixFileUrl(p.fileUrl) }} style={styles.cardImage} contentFit="cover" />
          </Pressable>
        ) : null}
        {p.text ? <Text style={styles.cardText}>{p.text}</Text> : null}

        {rlist.length > 0 ? (
          <View style={styles.reactions}>
            {rlist.map(([emoji, info]) => {
              const mine = info.users?.includes(me);
              return (
                <Pressable key={emoji} onPress={() => react(p, emoji)} style={[styles.reactionChip, mine && styles.reactionChipMine]}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={[styles.reactionCount, mine && { color: c.accent }]}>{info.count}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Pressable style={styles.footBtn} onPress={() => openReactPicker(p)} hitSlop={6}>
            <Ionicons name="heart-outline" size={19} color={c.textDim} />
            <Text style={styles.footText}>React</Text>
          </Pressable>
          <Pressable style={styles.footBtn} onPress={() => setCommentsFor(p)} hitSlop={6}>
            <Ionicons name="chatbubble-outline" size={18} color={c.textDim} />
            <Text style={styles.footText}>{p.commentsCount ? `${p.commentsCount}` : 'Comment'}</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <AuroraBackground palette={c}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {sel.active ? (
        <SelectionBar
          count={sel.count}
          total={selectableIds.length}
          paddingTop={insets.top}
          palette={c}
          onClose={sel.exit}
          onSelectAll={() => sel.selectAll(selectableIds)}
          onDelete={deleteSelected}
          label={t('common.selected')}
        />
      ) : (
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/channels'))} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Pressable
          hitSlop={4}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
          onPress={() => router.push({ pathname: '/(app)/channel-info/[id]', params: { id: String(channelId), name: channelName, avatar: channelAvatar, isMember: params.isMember || 'true', members: params.members || '0' } })}
        >
          <Avatar name={channelName} src={channelAvatar} size={42} palette={c} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.headerName}>{channelName}</Text>
            <Text style={styles.headerStatus}>{params.members || 0} subscribers · Channel</Text>
          </View>
        </Pressable>
      </View>
      )}

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <OfflineBanner />
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
        ) : posts.length === 0 ? (
          <View style={styles.center}><Ionicons name="megaphone-outline" size={42} color={c.textFaint} /><Text style={styles.empty}>No posts yet.</Text></View>
        ) : (
          <FlatList
            ref={listRef}
            data={[...posts].reverse()}
            inverted
            keyExtractor={(p) => String(p.id)}
            renderItem={renderPost}
            contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            windowSize={11}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            ListFooterComponent={loadingOlder ? <View style={styles.olderLoader}><ActivityIndicator size="small" color={c.accent} /></View> : null}
          />
        )}

        <View style={{ paddingBottom: insets.bottom + 8, paddingHorizontal: 12, paddingTop: 8 }}>
          {!member ? (
            <Button label={t('info.subscribe')} onPress={join} loading={joining} palette={c} />
          ) : canManage ? (
            <View style={styles.composer}>
              <Pressable onPress={publishImage} hitSlop={6} style={styles.composerIcon}><Ionicons name="image-outline" size={22} color={c.accent} /></Pressable>
              <TextInput
                value={text}
                onChangeText={onChangeText}
                placeholder="Share something…"
                placeholderTextColor={c.textFaint}
                style={styles.composerInput}
                multiline
              />
              <Pressable onPress={publish} disabled={posting || !text.trim()} style={{ opacity: text.trim() ? 1 : 0.4 }}>
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
                  <Ionicons name="arrow-up" size={22} color={c.ink} />
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <View style={styles.readonly}><Ionicons name="megaphone-outline" size={15} color={c.textFaint} /><Text style={styles.readonlyText}>Only the channel owner can post here</Text></View>
          )}
        </View>
      </KeyboardAvoidingView>

      {commentsFor ? (
        <CommentsModal channelId={channelId} post={commentsFor} canManage={canManage} me={me}
          onClose={() => setCommentsFor(null)}
          onAdded={(postId) => setPosts((prev) => prev.map((p) => (Number(p.id) === Number(postId) ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p)))}
        />
      ) : null}

      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)} statusBarTranslucent>
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          {lightbox ? <Image source={{ uri: fixFileUrl(lightbox) }} style={styles.lightboxImg} contentFit="contain" /> : null}
          <View style={[styles.lightboxClose, { top: insets.top + 12 }]}><Ionicons name="close" size={28} color="#fff" /></View>
        </Pressable>
      </Modal>
    </AuroraBackground>
  );
}

function CommentsModal({ channelId, post, canManage, me, onClose, onAdded }: { channelId: number; post: any; canManage: boolean; me: number; onClose: () => void; onAdded: (postId: number) => void }) {
  const insets = useSafeAreaInsets();
  const socket = useSocket();
  const { c: pal } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(pal), [pal]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    channelsApi.comments(channelId, post.id)
      .then((list: any) => setComments(Array.isArray(list) ? list : list?.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channelId, post.id]);

  useEffect(() => {
    const onDeleted = ({ commentId }: any) => {
      setComments((prev) => prev.filter((c) => Number(c.id) !== Number(commentId)));
    };
    socket.on('channelCommentDeleted', onDeleted);
    return () => { socket.off('channelCommentDeleted', onDeleted); };
  }, [socket]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    setText('');
    try {
      const c = await channelsApi.comment(channelId, post.id, { userId: me, text: t });
      setComments((prev) => [...prev, c?.comment || c || { id: Date.now(), text: t, sender: { username: 'You' }, createdAt: new Date().toISOString() }]);
      onAdded(post.id);
    } catch { setText(t); }
    finally { setSending(false); }
  };

  const deleteComment = async (commentId: number) => {
    setDeletingId(commentId);
    try {
      await channelsApi.deleteComment(channelId, post.id, commentId, me);
      setComments((prev) => prev.filter((c) => Number(c.id) !== commentId));
    } catch {}
    finally { setDeletingId(null); }
  };

  const renderComment = useCallback(({ item: c }: { item: any }) => {
    const cId = Number(c.id);
    const isDeleting = deletingId === cId;
    const canDelete = canManage || Number(c.sender?.id ?? c.userId) === me;
    return (
      <View style={styles.comment}>
        <Avatar name={c.sender?.username || c.username} src={c.sender?.avatar} size={34} palette={pal} />
        <View style={{ flex: 1 }}>
          <Text style={styles.commentName}>{c.sender?.username || c.username || 'User'}</Text>
          <Text style={styles.commentText}>{c.text}</Text>
        </View>
        {canDelete && (
          <Pressable hitSlop={10} onPress={() => deleteComment(cId)} disabled={isDeleting} style={styles.commentDel}>
            {isDeleting
              ? <ActivityIndicator size="small" color={pal.danger} />
              : <Ionicons name="trash-outline" size={16} color={pal.danger} />
            }
          </Pressable>
        )}
      </View>
    );
  }, [canManage, me, deletingId]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{t('feed.comments')}</Text>
        {loading ? (
          <View style={{ padding: 30 }}><ActivityIndicator color={pal.accent} /></View>
        ) : comments.length === 0 ? (
          <Text style={styles.noComments}>{t('feed.noComments')}</Text>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c, i) => String(c.id ?? i)}
            style={{ maxHeight: 360 }}
            renderItem={renderComment}
          />
        )}
        <View style={styles.commentComposer}>
          <TextInput value={text} onChangeText={setText} placeholder={t('feed.addComment')} placeholderTextColor={pal.textFaint} style={styles.commentInput} multiline />
          <Pressable onPress={add} disabled={sending || !text.trim()} style={{ opacity: text.trim() ? 1 : 0.4 }}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
              <Ionicons name="arrow-up" size={20} color={pal.ink} />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.stroke },
  headerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerName: { color: c.text, fontFamily: font.bodySemi, fontSize: 17 },
  headerStatus: { color: c.textFaint, fontFamily: font.body, fontSize: 12.5, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  olderLoader: { paddingVertical: 14, alignItems: 'center' },
  empty: { color: c.textDim, fontFamily: font.body, fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.stroke, borderRadius: radius.xl, padding: 16, marginBottom: 12 },
  cardSelected: { borderColor: c.accent, backgroundColor: c.accentSoft },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.stroke2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardName: { color: c.text, fontFamily: font.bodySemi, fontSize: 15 },
  cardTime: { color: c.textFaint, fontFamily: font.mono, fontSize: 11, marginTop: 1 },
  cardImage: { width: '100%', height: 240, borderRadius: radius.md, backgroundColor: c.glass2, marginBottom: 10 },
  cardText: { color: c.text, fontFamily: font.body, fontSize: 15.5, lineHeight: 22 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: c.glass2, borderRadius: radius.full, borderWidth: 1, borderColor: c.stroke },
  reactionChipMine: { backgroundColor: c.accentSoft, borderColor: c.accent },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { color: c.textDim, fontFamily: font.bodySemi, fontSize: 12 },
  cardFooter: { flexDirection: 'row', gap: 22, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.stroke },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footText: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 13.5 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke, borderRadius: radius.lg, paddingHorizontal: 8, paddingVertical: 6 },
  composerIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  composerInput: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, maxHeight: 120, paddingVertical: 8 },
  send: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  readonly: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  readonlyText: { color: c.textFaint, fontFamily: font.body, fontSize: 13 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '100%', height: '80%' },
  lightboxClose: { position: 'absolute', right: 18 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: c.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: c.stroke, paddingHorizontal: 16, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.stroke2, marginBottom: 12 },
  sheetTitle: { color: c.text, fontFamily: font.bodySemi, fontSize: 17, marginBottom: 10 },
  noComments: { color: c.textFaint, fontFamily: font.body, fontSize: 14, textAlign: 'center', paddingVertical: 26 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 9, alignItems: 'center' },
  commentName: { color: c.text, fontFamily: font.bodySemi, fontSize: 13.5 },
  commentText: { color: c.textDim, fontFamily: font.body, fontSize: 14, marginTop: 2, lineHeight: 20 },
  commentDel: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.stroke, marginTop: 6 },
  commentInput: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 15, maxHeight: 100, backgroundColor: c.glass, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: c.stroke },
});
