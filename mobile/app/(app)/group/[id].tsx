import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageActionSheet } from '@/components/chat/MessageActionSheet';
import { AttachSheet } from '@/components/chat/AttachSheet';
import { ReactionsViewer } from '@/components/chat/ReactionsViewer';
import { ForwardSheet } from '@/components/chat/ForwardSheet';
import { Composer } from '@/components/chat/Composer';
import { ScrollToBottomButton } from '@/components/chat/ScrollToBottomButton';
import { SelectionBar } from '@/components/ui/SelectionBar';
import { useSelection } from '@/lib/useSelection';
import { groupsApi, Message, ForwardPayload } from '@/lib/api';
import { decodeGroupMessageList, decodeGroupMessage, isBinary, GroupMsg } from '@/lib/groupProto';
import { cacheGet, cacheSet, cacheKeys } from '@/lib/offlineCache';
import { getIsOnline } from '@/lib/net';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuth } from '@/state/auth';
import { useSocket } from '@/state/socket';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';
import { font, Palette } from '@/theme/theme';
import { dayLabel } from '@/lib/format';
import { fixFileUrl } from '@/lib/config';

const PAGE_SIZE = 40;
const tempId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const fileKind = (mime = '') =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';

type GMsg = Omit<GroupMsg, 'id'> & { id: number | string; status?: 'sending' | 'failed' };
// One rendered row: the raw group message plus its precomputed Message mapping.
type Row = { raw: GMsg; msg: Message };

export default function GroupConversation() {
  const { user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{ id: string; name: string; avatar: string; ownerId: string; isMember: string }>();
  const me = Number(user?.userId);
  const groupId = Number(params.id);
  const [groupName, setGroupName] = useState(params.name || 'Group');
  const [groupAvatar, setGroupAvatar] = useState(params.avatar || '');

  const [messages, setMessages] = useState<GMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<number | null>(null); // id of the oldest loaded message
  const loadingOlderRef = useRef(false);
  const [members, setMembers] = useState<any[]>([]);
  const [member, setMember] = useState(params.isMember !== 'false');
  const [joining, setJoining] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const [reactionsMap, setReactionsMap] = useState<Record<number, { userId: number; emoji: string }[]>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [sheetMsg, setSheetMsg] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ForwardPayload | null>(null);
  const [forwardMany, setForwardMany] = useState<ForwardPayload[] | null>(null);
  const [reactorsMsg, setReactorsMsg] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const sel = useSelection<number>();
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const listRef = useRef<FlatList<Row>>(null);
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const atBottomRef = useRef(true);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated }));
  }, []);

  const onScroll = useCallback((e: any) => {
    // Inverted list: the newest message sits at offset 0 (the visual bottom).
    const near = e.nativeEvent.contentOffset.y < 120;
    atBottomRef.current = near;
    setAtBottom(near);
    if (near) setNewCount(0);
  }, []);

  const jumpToLatest = useCallback(() => {
    setNewCount(0);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }, []);

  const addMessage = useCallback((m: GMsg, fromMe = false) => {
    setMessages((prev) => {
      if (prev.some((p) => Number(p.id) === Number(m.id))) return prev;
      if (fromMe) {
        const ti = prev.findIndex((p) => p.status === 'sending' && p.text === m.text && Number(p.fromUserId) === me);
        if (ti >= 0) {
          const next = [...prev];
          next[ti] = m;
          return next;
        }
      }
      return [...prev, m];
    });
  }, [me]);

  // Load an older page when the user scrolls to the top of the history.
  // Inverted list: older messages are prepended to the chronological `messages`
  // array, which keeps the scroll position stable.
  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMore || cursorRef.current == null) return;
    if (!(await getIsOnline())) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const { buffer, hasMore: more, nextBefore } = await groupsApi.messagesRawPage(groupId, me, PAGE_SIZE, cursorRef.current);
      const older = decodeGroupMessageList(buffer) as GMsg[];
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => Number(m.id)));
        const fresh = older.filter((m) => !seen.has(Number(m.id)));
        return fresh.length ? [...fresh, ...prev] : prev;
      });
      setHasMore(!!more);
      cursorRef.current = nextBefore ?? (older.length ? Number(older[0].id) : null);
    } catch {
      // keep cursor; user can retry by scrolling again
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasMore, groupId, me]);

  // Load history + join room
  useEffect(() => {
    if (!member) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    atBottomRef.current = true;
    cursorRef.current = null;
    loadingOlderRef.current = false;
    setHasMore(false);
    setLoadingOlder(false);
    socket.emit('joinGroup', { groupId, userId: me });
    socket.emit('joinRoom', `group_${groupId}`);
    // Cache-first (Telegram-style): paint cached messages instantly so re-opening
    // a group never flashes a spinner, then reconcile with the server in the
    // background. Spinner only shows on a true cold open (no cache yet).
    const key = cacheKeys.groupMessages(groupId);
    // Fire-and-forget cache paint — must NOT block the network path: SQLite is
    // unavailable on web and `cacheGet` would otherwise hang the whole load
    // forever (perpetual spinner). Never clobber a fresh network result.
    cacheGet<GMsg[]>(key).then((cached) => {
      if (alive && cached?.length) {
        setMessages((prev) => (prev.length ? prev : cached));
        setLoading(false);
        scrollToEnd(false);
      }
    }).catch(() => {});
    (async () => {
      if (!(await getIsOnline())) {
        // Offline: rely on the cache paint above; just clear the spinner.
        if (alive) { setHasMore(false); setLoading(false); scrollToEnd(false); }
        return;
      }
      try {
        const { buffer, hasMore: more, nextBefore } = await groupsApi.messagesRawPage(groupId, me, PAGE_SIZE);
        if (!alive) return;
        const list = decodeGroupMessageList(buffer) as GMsg[];
        setMessages(list);
        setHasMore(!!more);
        cursorRef.current = nextBefore ?? (list.length ? Number(list[0].id) : null);
        setLoading(false);
        scrollToEnd(false);
        cacheSet(key, list.slice(-50));
      } catch {
        if (alive) { setHasMore(false); setLoading(false); scrollToEnd(false); }
      }
    })();
    groupsApi.members(groupId).then((m) => alive && setMembers(m || [])).catch(() => {});
    groupsApi.reactions(groupId).then((map) => alive && setReactionsMap(map || {})).catch(() => {});
    groupsApi.updateLastSeen(groupId, me).catch(() => {});
    return () => { alive = false; };
  }, [groupId, member]);

  // Realtime
  useEffect(() => {
    if (!member) return;
    const onReceived = (data: any) => {
      let m: GMsg | null = null;
      if (isBinary(data)) m = decodeGroupMessage(data);
      else if (data && Number(data.groupId) === groupId)
        m = { ...(data as any), fromUserId: data.userId, createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString() };
      if (!m || Number(m.groupId) !== groupId) return;
      const mine = Number(m.fromUserId) === me;
      addMessage(m, mine);
      if (mine || atBottomRef.current) scrollToEnd();
      else setNewCount((c) => c + 1);
      if (!mine) groupsApi.updateLastSeen(groupId, me).catch(() => {});
    };
    const onUpdated = (data: any) => {
      const m = isBinary(data) ? decodeGroupMessage(data) : data;
      if (!m || Number(m.groupId) !== groupId) return;
      setMessages((prev) => prev.map((x) => (Number(x.id) === Number(m.id) ? { ...x, ...m } : x)));
    };
    const onDeleted = ({ messageId }: any) => setMessages((prev) => prev.filter((x) => Number(x.id) !== Number(messageId)));
    const onTyping = ({ userId, username, isTyping }: any) => {
      if (Number(userId) === me) return;
      setTypingUsers((prev) => { const n = { ...prev }; if (isTyping) n[userId] = username || `User ${userId}`; else delete n[userId]; return n; });
      clearTimeout(typingTimers.current[userId]);
      if (isTyping) typingTimers.current[userId] = setTimeout(() => setTypingUsers((p) => { const n = { ...p }; delete n[userId]; return n; }), 4000);
    };
    const onReactionAdded = ({ messageId, userId, emoji }: any) => {
      setReactionsMap((prev) => {
        const list = prev[messageId] || [];
        if (list.some((r) => r.userId === userId && r.emoji === emoji)) return prev;
        return { ...prev, [messageId]: [...list, { userId, emoji }] };
      });
    };
    const onReactionRemoved = ({ messageId, userId, emoji }: any) =>
      setReactionsMap((prev) => ({ ...prev, [messageId]: (prev[messageId] || []).filter((r) => !(r.userId === userId && r.emoji === emoji)) }));
    const onCleared = ({ groupId: gid }: any) => { if (Number(gid) === groupId) setMessages([]); };
    const onGroupUpdated = ({ groupId: gid, updatedFields }: any) => {
      if (Number(gid) !== groupId) return;
      if (updatedFields?.name) setGroupName(updatedFields.name);
      if (updatedFields?.avatar) setGroupAvatar(updatedFields.avatar);
    };

    socket.on('groupMessageReceived', onReceived);
    socket.on('groupMessageUpdated', onUpdated);
    socket.on('groupMessageDeleted', onDeleted);
    socket.on('groupTyping', onTyping);
    socket.on('groupReactionAdded', onReactionAdded);
    socket.on('groupReactionRemoved', onReactionRemoved);
    socket.on('groupMessagesCleared', onCleared);
    socket.on('groupUpdated', onGroupUpdated);
    return () => {
      socket.off('groupMessageReceived', onReceived);
      socket.off('groupMessageUpdated', onUpdated);
      socket.off('groupMessageDeleted', onDeleted);
      socket.off('groupTyping', onTyping);
      socket.off('groupReactionAdded', onReactionAdded);
      socket.off('groupReactionRemoved', onReactionRemoved);
      socket.off('groupMessagesCleared', onCleared);
      socket.off('groupUpdated', onGroupUpdated);
    };
  }, [socket, groupId, me, member, addMessage, scrollToEnd]);

  // Send
  const sendText = async (text: string) => {
    const tId = tempId();
    const r = replyTo;
    setMessages((prev) => [...prev, {
      id: tId, groupId, fromUserId: me, userId: me, text, type: 'text', fileUrl: null, filename: null, replyToId: r ? Number(r.id) : null,
      isDeleted: false, isEdited: false, createdAt: new Date().toISOString(), sender: { id: me, username: user!.username }, readBy: [me],
      forwardedFromType: null, forwardedFromUsername: null,
      replyTo: r ? { id: Number(r.id), text: r.text || '', fromUserId: r.fromUserId } : null, status: 'sending',
    }]);
    setReplyTo(null);
    scrollToEnd();
    try {
      await groupsApi.sendMessage(groupId, { userId: me, text, replyToId: r ? Number(r.id) : undefined });
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tId ? { ...m, status: 'failed' } : m)));
    }
  };

  const sendAsset = async (asset: { uri: string; name?: string; mime?: string }) => {
    try {
      await groupsApi.sendMessage(groupId, { userId: me, text: '', file: { uri: asset.uri, name: asset.name, type: asset.mime }, messageType: fileKind(asset.mime || '') });
    } catch {
      Alert.alert('Upload failed', 'Could not send that file.');
    }
  };

  // Live mirror of messages so stable (useCallback) handlers can read the latest
  // list without being recreated on every change (keeps memoized bubbles still).
  const messagesRef = useRef<GMsg[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Re-send a text message that previously failed; the socket echo reconciles it.
  const resendGroupMessage = useCallback(async (m: GMsg) => {
    setMessages((prev) => prev.map((x) => (Number(x.id) === Number(m.id) ? { ...x, status: 'sending' } : x)));
    try {
      await groupsApi.sendMessage(groupId, { userId: me, text: m.text || '', replyToId: m.replyToId ?? undefined });
    } catch {
      setMessages((prev) => prev.map((x) => (Number(x.id) === Number(m.id) ? { ...x, status: 'failed' } : x)));
    }
  }, [groupId, me]);
  const retryMessage = useCallback((msg: Message) => {
    const m = messagesRef.current.find((x) => Number(x.id) === Number(msg.id));
    if (!m) return;
    Alert.alert(t('msg.notSent'), undefined, [
      { text: t('msg.resend'), onPress: () => resendGroupMessage(m) },
      { text: t('common.delete'), style: 'destructive', onPress: () => setMessages((prev) => prev.filter((x) => Number(x.id) !== Number(msg.id))) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [t, resendGroupMessage]);
  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    sendAsset({ uri: a.uri, name: a.fileName || `media_${Date.now()}`, mime: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg') });
  };
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    sendAsset({ uri: a.uri, name: a.fileName || `photo_${Date.now()}.jpg`, mime: a.mimeType || 'image/jpeg' });
  };
  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    sendAsset({ uri: a.uri, name: a.name, mime: a.mimeType });
  };

  const join = async () => {
    setJoining(true);
    try { await groupsApi.join(groupId, me); setMember(true); }
    catch (e: any) { Alert.alert('Join failed', e?.response?.data?.error || 'Could not join.'); }
    finally { setJoining(false); }
  };

  const react = useCallback(async (mId: number, emoji: string) => {
    setSheetMsg(null);
    setReactionsMap((prev) => {
      const list = prev[mId] || [];
      const existing = list.find((r) => r.userId === me && r.emoji === emoji);
      return { ...prev, [mId]: existing ? list.filter((r) => !(r.userId === me && r.emoji === emoji)) : [...list, { userId: me, emoji }] };
    });
    try { await groupsApi.react(groupId, mId, me, emoji); } catch {}
  }, [groupId, me]);
  // Stable wrappers so memoized bubbles keep their identity across list updates.
  const onReactBubble = useCallback((mm: Message, emoji: string) => react(Number(mm.id), emoji), [react]);
  const toggleSelect = useCallback((mm: Message) => sel.toggle(Number(mm.id)), [sel.toggle]);

  const onSheetAction = (action: 'reply' | 'edit' | 'copy' | 'forward' | 'delete' | 'select') => {
    const msg = sheetMsg;
    setSheetMsg(null);
    if (!msg) return;
    if (action === 'select') { sel.enter(Number(msg.fromUserId) === me ? Number(msg.id) : undefined); return; }
    if (action === 'forward') {
      setForwardMsg({
        id: Number(msg.id),
        sourceType: 'group',
        text: msg.text,
        type: msg.type,
        fileUrl: msg.fileUrl ?? null,
        filename: msg.filename ?? null,
        senderUsername: msg.forwardedFromUsername || (msg as any).sender?.username || user?.username || '',
      });
      return;
    }
    if (action === 'reply') setReplyTo(msg);
    else if (action === 'edit') setEditing(msg);
    else if (action === 'copy') Clipboard.setStringAsync(msg.text || '');
    else if (action === 'delete') {
      setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(msg.id)));
      groupsApi.deleteMessage(groupId, msg.id, me).catch(() => {});
    }
  };
  const saveEdit = async (newText: string) => {
    const target = editing;
    setEditing(null);
    if (!target || newText === target.text) return;
    setMessages((prev) => prev.map((m) => (Number(m.id) === Number(target.id) ? { ...m, text: newText, isEdited: true } : m)));
    try { await groupsApi.editMessage(groupId, target.id, { userId: me, text: newText }); } catch {}
  };

  const emitTyping = (isTyping: boolean) => socket.emit('typing', { userId: me, groupId, isTyping });

  // Map group message → Message shape for the shared bubble.
  const toMessage = (m: GMsg): Message => ({
    id: m.id, fromUserId: m.fromUserId, toUserId: 0, text: m.text, type: m.type, fileUrl: m.fileUrl || undefined,
    filename: m.filename || undefined, createdAt: m.createdAt, isEdited: m.isEdited, isDeleted: m.isDeleted,
    status: m.status,
    forwardedFromType: m.forwardedFromType || null,
    forwardedFromUsername: m.forwardedFromUsername || null,
    replyTo: m.replyTo ? { id: m.replyTo.id, text: m.replyTo.text, fromUserId: m.replyTo.fromUserId } : null,
    reactions: (reactionsMap[Number(m.id)] || []).map((r) => ({ messageId: m.id, userId: r.userId, emoji: r.emoji })),
  });

  const visible = messages.filter((m) => !m.isDeleted);
  // Inverted list renders newest-first, so the latest message is at the bottom.
  // Memoize the raw→Message mapping keyed on the data that affects it, so each
  // bubble's `msg` prop keeps a stable identity and React.memo can skip renders.
  // Without this, toMessage() built a fresh object every render and defeated memo.
  const rows = useMemo(() => {
    const ordered = [...messages.filter((m) => !m.isDeleted)].reverse();
    return ordered.map((raw) => ({ raw, msg: toMessage(raw) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, reactionsMap]);
  const typingNames = Object.values(typingUsers);
  // Only own messages can be deleted, so only those are selectable.
  const selectableIds = visible.filter((m) => Number(m.fromUserId) === me).map((m) => Number(m.id));

  const copySelected = () => {
    const texts = messages
      .filter((m) => sel.selected.has(Number(m.id)) && m.text && m.text.trim())
      .map((m) => m.text!.trim());
    if (texts.length) Clipboard.setStringAsync(texts.join('\n'));
    sel.exit();
  };

  const forwardSelected = () => {
    const payloads: ForwardPayload[] = messages
      .filter((m) => sel.selected.has(Number(m.id)))
      .map((m) => ({
        id: Number(m.id),
        sourceType: 'group' as const,
        text: m.text,
        type: m.type,
        fileUrl: m.fileUrl ?? null,
        filename: m.filename ?? null,
        senderUsername: m.forwardedFromUsername || (m as any).sender?.username || user?.username || '',
      }));
    sel.exit();
    if (payloads.length) setForwardMany(payloads);
  };

  const deleteSelected = () => {
    const ids = [...sel.selected];
    if (ids.length === 0) return;
    Alert.alert(t('msg.deleteTitle'), t('msg.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const idSet = new Set(ids);
          setMessages((prev) => prev.filter((m) => !idSet.has(Number(m.id))));
          ids.forEach((id) => groupsApi.deleteMessage(groupId, id, me).catch(() => {}));
          sel.exit();
        },
      },
    ]);
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
          extraActions={[
            { icon: 'arrow-redo-outline', onPress: forwardSelected },
            { icon: 'copy-outline', onPress: copySelected },
          ]}
          onDelete={deleteSelected}
        />
      ) : (
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/groups'))} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Pressable
          hitSlop={4}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
          onPress={() => router.push({ pathname: '/(app)/group-info/[id]', params: { id: String(groupId), name: groupName, avatar: groupAvatar, isMember: String(!!member) } })}
        >
          <Avatar name={groupName} src={groupAvatar} size={42} palette={c} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.headerName}>{groupName}</Text>
            <Text numberOfLines={1} style={[styles.headerStatus, typingNames.length > 0 && { color: c.accent }]}>
              {typingNames.length ? `${typingNames.slice(0, 2).join(', ')} typing…` : `${members.length || ''} member${members.length === 1 ? '' : 's'}`}
            </Text>
          </View>
        </Pressable>
      </View>
      )}

      {!member ? (
        <View style={styles.joinWrap}>
          <Avatar name={groupName} src={groupAvatar} size={96} ring palette={c} />
          <Text style={styles.joinTitle}>{groupName}</Text>
          <Text style={styles.joinBody}>Join this group to see messages and participate.</Text>
          <Button label="Join group" onPress={join} loading={joining} style={{ marginTop: 18, minWidth: 200 }} palette={c} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <OfflineBanner />
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
          ) : visible.length === 0 ? (
            <View style={styles.center}><Text style={styles.empty}>No messages yet. Say hello! 👋</Text></View>
          ) : (
            <FlatList
              ref={listRef}
              data={rows}
              inverted
              keyExtractor={(r) => String(r.raw.id)}
              contentContainerStyle={{ paddingVertical: 12 }}
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              onEndReached={loadOlder}
              onEndReachedThreshold={0.4}
              windowSize={11}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              ListFooterComponent={loadingOlder ? <View style={styles.olderLoader}><ActivityIndicator size="small" color={c.accent} /></View> : null}
              renderItem={({ item, index }) => {
                // rows is newest-first, so the chronologically older message is next in the array.
                const raw = item.raw;
                const prev = rows[index + 1]?.raw;
                const isOut = Number(raw.fromUserId) === me;
                const sameSender = prev && Number(prev.fromUserId) === Number(raw.fromUserId);
                const closeInTime = prev && new Date(raw.createdAt).getTime() - new Date(prev.createdAt).getTime() < 4 * 60 * 1000;
                const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(raw.createdAt);
                const grouped = !!(sameSender && closeInTime && !newDay);
                return (
                  <View>
                    {newDay ? <View style={styles.daySep}><Text style={styles.dayText}>{dayLabel(raw.createdAt)}</Text></View> : null}
                    <MessageBubble
                      msg={item.msg}
                      isOut={isOut}
                      grouped={grouped}
                      me={me}
                      palette={c}
                      myUsername={user?.username}
                      senderName={!isOut && !grouped ? raw.sender?.username : undefined}
                      onLongPress={setSheetMsg}
                      onImagePress={setLightbox}
                      onReactToggle={onReactBubble}
                      onRetry={retryMessage}
                      onReply={setReplyTo}
                      onShowReactors={setReactorsMsg}
                      selectionMode={sel.active}
                      selected={sel.isSelected(Number(raw.id))}
                      selectable={isOut}
                      onToggleSelect={toggleSelect}
                    />
                  </View>
                );
              }}
            />
          )}

          {typingNames.length > 0 ? (
            <View style={styles.typingRow}><Text style={styles.typingText}>{typingNames.slice(0, 2).join(', ')} typing…</Text></View>
          ) : null}

          <ScrollToBottomButton
            visible={!sel.active && (!atBottom || newCount > 0)}
            count={newCount}
            onPress={jumpToLatest}
            bottom={insets.bottom + 76}
          />

          {!sel.active && (
            <View style={{ paddingBottom: insets.bottom + 6 }}>
              <Composer
                replyTo={replyTo}
                editing={editing}
                draftKey={Number.isFinite(me) ? `draft.${me}.group.${groupId}` : null}
                onCancelReply={() => setReplyTo(null)}
                onCancelEdit={() => setEditing(null)}
                onSend={sendText}
                onSaveEdit={saveEdit}
                onAttach={() => setAttachOpen(true)}
                onSendAudio={sendAsset}
                onTyping={emitTyping}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      <AttachSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onCamera={takePhoto}
        onGallery={pickMedia}
        onFile={pickFile}
      />
      <MessageActionSheet
        message={sheetMsg}
        isOut={!!sheetMsg && Number(sheetMsg.fromUserId) === me}
        onClose={() => setSheetMsg(null)}
        onReact={(emoji) => sheetMsg && react(Number(sheetMsg.id), emoji)}
        onAction={onSheetAction}
      />
      <ForwardSheet
        visible={!!forwardMsg || !!(forwardMany && forwardMany.length)}
        message={forwardMsg}
        messages={forwardMany ?? undefined}
        userId={me}
        onClose={() => { setForwardMsg(null); setForwardMany(null); }}
      />
      <ReactionsViewer
        visible={!!reactorsMsg}
        reactions={(reactorsMsg?.reactions || []).map((r) => ({ userId: Number(r.userId), emoji: r.emoji }))}
        resolveName={(id) => {
          const mm: any = members.find((x: any) => Number(x.id ?? x.userId) === id);
          return mm?.username || (id === me ? t('feed.you') : `#${id}`);
        }}
        resolveAvatar={(id) => {
          const mm: any = members.find((x: any) => Number(x.id ?? x.userId) === id);
          return mm?.avatar || undefined;
        }}
        onClose={() => setReactorsMsg(null)}
      />

      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)} statusBarTranslucent>
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          {lightbox ? <Image source={{ uri: fixFileUrl(lightbox) }} style={styles.lightboxImg} contentFit="contain" /> : null}
          <View style={[styles.lightboxClose, { top: insets.top + 12 }]}><Ionicons name="close" size={28} color="#fff" /></View>
        </Pressable>
      </Modal>
    </AuroraBackground>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.stroke },
  headerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerName: { color: c.text, fontFamily: font.bodySemi, fontSize: 17 },
  headerStatus: { color: c.textFaint, fontFamily: font.body, fontSize: 12.5, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  empty: { color: c.textDim, fontFamily: font.body, fontSize: 15, textAlign: 'center' },
  joinWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  joinTitle: { color: c.text, fontFamily: font.display, fontSize: 24, marginTop: 14 },
  joinBody: { color: c.textDim, fontFamily: font.body, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  olderLoader: { paddingVertical: 14, alignItems: 'center' },
  daySep: { alignItems: 'center', marginVertical: 12 },
  dayText: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 12, backgroundColor: c.glass2, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
  typingRow: { paddingHorizontal: 18, paddingBottom: 4 },
  typingText: { color: c.accent, fontFamily: font.bodyMed, fontSize: 12.5 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '100%', height: '80%' },
  lightboxClose: { position: 'absolute', right: 18 },
});
