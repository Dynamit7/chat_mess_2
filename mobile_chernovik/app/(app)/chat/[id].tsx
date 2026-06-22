import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Modal,
} from 'react-native';
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
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageActionSheet } from '@/components/chat/MessageActionSheet';
import { AttachSheet } from '@/components/chat/AttachSheet';
import { ReactionsViewer } from '@/components/chat/ReactionsViewer';
import { ForwardSheet } from '@/components/chat/ForwardSheet';
import { Composer } from '@/components/chat/Composer';
import { ScrollToBottomButton } from '@/components/chat/ScrollToBottomButton';
import { SelectionBar } from '@/components/ui/SelectionBar';
import { useSelection } from '@/lib/useSelection';
import { messagesApi, uploadFile, chatKeyOf, Message, ForwardPayload } from '@/lib/api';

const PAGE_SIZE = 40;
import { cacheGet, cacheSet, cacheKeys } from '@/lib/offlineCache';
import { getIsOnline } from '@/lib/net';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuth } from '@/state/auth';
import { useSocket } from '@/state/socket';
import { useCall } from '@/state/call';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';
import { font, radius, shadow, Palette } from '@/theme/theme';
import { dayLabel } from '@/lib/format';

const tempId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const fileKind = (mime = '') =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';

export default function ConversationScreen() {
  const { user } = useAuth();
  const socket = useSocket();
  const call = useCall();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{ id: string; name: string; avatar: string }>();
  const me = Number(user?.userId);
  const partnerId = Number(params.id);
  const partnerName = params.name || 'Chat';
  const chatKey = chatKeyOf(me, partnerId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<number | null>(null); // id of the oldest loaded message
  const loadingOlderRef = useRef(false);
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [sheetMsg, setSheetMsg] = useState<Message | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ForwardPayload | null>(null);
  const [forwardMany, setForwardMany] = useState<ForwardPayload[] | null>(null);
  const [reactorsMsg, setReactorsMsg] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const sel = useSelection<number>();
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const listRef = useRef<FlatList<Message>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atBottomRef = useRef(true);

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

  const belongs = useCallback(
    (m: any) => {
      const a = Number(m.fromUserId), b = Number(m.toUserId);
      return (a === me && b === partnerId) || (a === partnerId && b === me);
    },
    [me, partnerId]
  );

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated }));
  }, []);

  const mergeMessage = useCallback((incoming: Message) => {
    setMessages((prev) => {
      if (incoming.tempId) {
        const ti = prev.findIndex((p) => p.tempId && p.tempId === incoming.tempId);
        if (ti >= 0) {
          const next = [...prev];
          next[ti] = { ...incoming, status: undefined, isRead: prev[ti].isRead || incoming.isRead };
          return next;
        }
      }
      if (prev.some((p) => Number(p.id) === Number(incoming.id))) return prev;
      return [...prev, incoming];
    });
  }, []);

  // Load an older page when the user scrolls to the top of the history.
  // Inverted list: reaching the visual top fires onEndReached. Older messages
  // are prepended to the chronological `messages` array (start), which keeps the
  // scroll position stable on an inverted list.
  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMore || cursorRef.current == null) return;
    if (!(await getIsOnline())) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await messagesApi.getMessagesPage(me, partnerId, PAGE_SIZE, cursorRef.current);
      const older = Array.isArray(page?.messages) ? page.messages : [];
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => Number(m.id)));
        const fresh = older.filter((m) => !seen.has(Number(m.id)));
        return fresh.length ? [...fresh, ...prev] : prev;
      });
      setHasMore(!!page?.hasMore);
      cursorRef.current = page?.nextBefore ?? (older.length ? Number(older[0].id) : null);
    } catch {
      // keep current cursor; the user can retry by scrolling again
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasMore, me, partnerId]);

  // Load history + join room + mark read
  useEffect(() => {
    let alive = true;
    setLoading(true);
    atBottomRef.current = true;
    cursorRef.current = null;
    loadingOlderRef.current = false;
    setHasMore(false);
    setLoadingOlder(false);
    socket.emit('joinRoom', `chat_${chatKey}`);

    // online → API (first page) + cache; offline → read local SQLite
    (async () => {
      const key = cacheKeys.directMessages(chatKey);
      if (!(await getIsOnline())) {
        const cached = await cacheGet<Message[]>(key);
        if (alive) { setMessages(cached || []); setHasMore(false); setLoading(false); scrollToEnd(false); }
        return;
      }
      try {
        const page = await messagesApi.getMessagesPage(me, partnerId, PAGE_SIZE);
        if (!alive) return;
        const list = Array.isArray(page?.messages) ? page.messages : [];
        setMessages(list);
        setHasMore(!!page?.hasMore);
        cursorRef.current = page?.nextBefore ?? (list.length ? Number(list[0].id) : null);
        setLoading(false);
        scrollToEnd(false);
        cacheSet(key, list.slice(-50)); // keep most recent messages for offline
      } catch {
        const cached = await cacheGet<Message[]>(key);
        if (alive) { if (cached) setMessages(cached); setHasMore(false); setLoading(false); scrollToEnd(false); }
      }
    })();

    socket.emit('messagesRead', { readerId: me, partnerId, unreadCount: 0 });
    messagesApi.markAsRead(me, partnerId).catch(() => {});
    return () => { alive = false; };
  }, [chatKey]);

  // Realtime listeners
  useEffect(() => {
    const onReceived = (m: any) => {
      if (!belongs(m)) return;
      mergeMessage(m);
      if (Number(m.fromUserId) === partnerId) {
        if (atBottomRef.current) scrollToEnd();
        else setNewCount((c) => c + 1);
        socket.emit('messagesRead', { readerId: me, partnerId, unreadCount: 0 });
        messagesApi.markAsRead(me, partnerId).catch(() => {});
      } else {
        scrollToEnd();
      }
    };
    const onEdited = ({ messageId, newText, isEdited }: any) =>
      setMessages((prev) => prev.map((m) => (Number(m.id) === Number(messageId) ? { ...m, text: newText, isEdited: isEdited ?? true } : m)));
    const onDeleted = ({ messageId }: any) =>
      setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(messageId)));
    const onTyping = ({ userId, isTyping }: any) => {
      if (Number(userId) !== partnerId) return;
      setTyping(isTyping);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (isTyping) { typingTimer.current = setTimeout(() => setTyping(false), 4000); scrollToEnd(); }
    };
    const onReadByRecipient = ({ readerId }: any) => {
      if (Number(readerId) === partnerId) setMessages((prev) => prev.map((m) => (Number(m.fromUserId) === me ? { ...m, isRead: true } : m)));
    };
    const onStatus = ({ messageId, status }: any) => {
      if (status !== 'delivered') return;
      setMessages((prev) => prev.map((m) => (Number(m.id) === Number(messageId) ? { ...m, isDelivered: true } : m)));
    };
    const onReactionAdded = (r: any) =>
      setMessages((prev) => prev.map((m) => {
        if (Number(m.id) !== Number(r.messageId)) return m;
        const exists = (m.reactions || []).some((x) => Number(x.userId) === Number(r.userId) && x.emoji === r.emoji);
        if (exists) return m;
        return { ...m, reactions: [...(m.reactions || []), { messageId: r.messageId, userId: r.userId, emoji: r.emoji }] };
      }));
    const onReactionRemoved = ({ messageId, userId, emoji }: any) =>
      setMessages((prev) => prev.map((m) => (Number(m.id) === Number(messageId)
        ? { ...m, reactions: (m.reactions || []).filter((x) => !(Number(x.userId) === Number(userId) && x.emoji === emoji)) }
        : m)));
    const onUserOnline = ({ userId }: any) => { if (Number(userId) === partnerId) setOnline(true); };
    const onUserOffline = ({ userId }: any) => { if (Number(userId) === partnerId) setOnline(false); };

    socket.on('messageReceived', onReceived);
    socket.on('messageEdited', onEdited);
    socket.on('messageDeleted', onDeleted);
    socket.on('userTyping', onTyping);
    socket.on('messagesReadByRecipient', onReadByRecipient);
    socket.on('messageStatus', onStatus);
    socket.on('reactionAdded', onReactionAdded);
    socket.on('reactionRemoved', onReactionRemoved);
    socket.on('userOnline', onUserOnline);
    socket.on('userOffline', onUserOffline);
    return () => {
      socket.off('messageReceived', onReceived);
      socket.off('messageEdited', onEdited);
      socket.off('messageDeleted', onDeleted);
      socket.off('userTyping', onTyping);
      socket.off('messagesReadByRecipient', onReadByRecipient);
      socket.off('messageStatus', onStatus);
      socket.off('reactionAdded', onReactionAdded);
      socket.off('reactionRemoved', onReactionRemoved);
      socket.off('userOnline', onUserOnline);
      socket.off('userOffline', onUserOffline);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [socket, belongs, me, partnerId, mergeMessage, scrollToEnd]);

  // Send text
  const sendText = async (text: string) => {
    const tId = tempId();
    const optimistic: Message = {
      id: tId, tempId: tId, fromUserId: me, toUserId: partnerId, text, type: 'text',
      createdAt: new Date().toISOString(), isRead: false, reactions: [],
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, fromUserId: replyTo.fromUserId } : null,
      status: 'sending',
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToEnd();
    const payload = { fromUserId: me, toUserId: partnerId, text, type: 'text', replyToId: replyTo?.id || null, tempId: tId };
    setReplyTo(null);
    try {
      const res = await messagesApi.send(payload);
      if (res?.message) mergeMessage(res.message);
    } catch {
      setMessages((prev) => prev.map((m) => (m.tempId === tId ? { ...m, status: 'failed' } : m)));
    }
  };

  // Send file
  const sendAsset = async (asset: { uri: string; name?: string; mime?: string }) => {
    const kind = fileKind(asset.mime || '');
    setUploadPct(0);
    try {
      const url = await uploadFile({ uri: asset.uri, name: asset.name, type: asset.mime });
      const tId = tempId();
      const optimistic: Message = {
        id: tId, tempId: tId, fromUserId: me, toUserId: partnerId, text: '', type: kind, fileUrl: url,
        filename: asset.name, createdAt: new Date().toISOString(), isRead: false, reactions: [], status: 'sending',
      };
      setMessages((prev) => [...prev, optimistic]);
      scrollToEnd();
      const res = await messagesApi.send({ fromUserId: me, toUserId: partnerId, text: '', type: kind, fileUrl: url, filename: asset.name, tempId: tId });
      if (res?.message) mergeMessage(res.message);
    } catch {
      Alert.alert('Upload failed', 'Could not send that file. Try a smaller one.');
    } finally {
      setUploadPct(null);
    }
  };

  // Re-send a message that previously failed (text + already-uploaded files alike).
  const resendMessage = async (m: Message) => {
    const tId = tempId();
    setMessages((prev) => prev.map((x) => (Number(x.id) === Number(m.id) ? { ...x, id: tId, tempId: tId, status: 'sending' } : x)));
    try {
      const res = await messagesApi.send({
        fromUserId: me, toUserId: partnerId,
        text: m.text || '', type: m.type || 'text',
        fileUrl: m.fileUrl ?? null, filename: m.filename ?? null,
        replyToId: m.replyTo?.id ?? null, tempId: tId,
      });
      if (res?.message) mergeMessage(res.message);
    } catch {
      setMessages((prev) => prev.map((x) => (x.tempId === tId ? { ...x, status: 'failed' } : x)));
    }
  };
  const retryMessage = (m: Message) =>
    Alert.alert(t('msg.notSent'), undefined, [
      { text: t('msg.resend'), onPress: () => resendMessage(m) },
      { text: t('common.delete'), style: 'destructive', onPress: () => setMessages((prev) => prev.filter((x) => Number(x.id) !== Number(m.id))) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);

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

  // Actions from the sheet
  const reactTo = async (msg: Message, emoji: string) => {
    setSheetMsg(null);
    const mine = (msg.reactions || []).find((r) => Number(r.userId) === me && r.emoji === emoji);
    try {
      if (mine) {
        setMessages((prev) => prev.map((m) => (Number(m.id) === Number(msg.id) ? { ...m, reactions: (m.reactions || []).filter((r) => !(Number(r.userId) === me && r.emoji === emoji)) } : m)));
        await messagesApi.removeReaction(msg.id, me, emoji);
      } else {
        setMessages((prev) => prev.map((m) => (Number(m.id) === Number(msg.id) ? { ...m, reactions: [...(m.reactions || []), { messageId: msg.id, userId: me, emoji }] } : m)));
        await messagesApi.react(msg.id, me, emoji);
      }
    } catch {}
  };

  const onSheetAction = (action: 'reply' | 'edit' | 'copy' | 'forward' | 'delete' | 'select') => {
    const msg = sheetMsg;
    setSheetMsg(null);
    if (!msg) return;
    if (action === 'select') sel.enter(Number(msg.fromUserId) === me ? Number(msg.id) : undefined);
    else if (action === 'reply') setReplyTo(msg);
    else if (action === 'edit') setEditing(msg);
    else if (action === 'copy') Clipboard.setStringAsync(msg.text || '');
    else if (action === 'forward') {
      setForwardMsg({
        id: Number(msg.id),
        sourceType: 'direct',
        text: msg.text,
        type: msg.type,
        fileUrl: msg.fileUrl ?? null,
        filename: msg.filename ?? null,
        senderUsername: msg.forwardedFromUsername || (Number(msg.fromUserId) === me ? (user?.username || '') : (params.name || partnerName)),
      });
    } else if (action === 'delete') {
      setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(msg.id)));
      messagesApi.remove(msg.id).catch(() => {});
      socket.emit('deleteMessage', { roomName: `chat_${chatKey}`, messageId: msg.id });
    }
  };

  const saveEdit = async (newText: string) => {
    const target = editing;
    setEditing(null);
    if (!target || newText === target.text) return;
    setMessages((prev) => prev.map((m) => (Number(m.id) === Number(target.id) ? { ...m, text: newText, isEdited: true } : m)));
    try {
      await messagesApi.edit(target.id, newText);
      socket.emit('editMessage', { roomName: `chat_${chatKey}`, messageId: target.id, newText });
    } catch {}
  };

  const emitTyping = (isTyping: boolean) => socket.emit('typing', { userId: me, chatId: chatKey, isTyping });

  const placeCall = async (video: boolean) => {
    if (!call.available) {
      Alert.alert('Звонки недоступны', 'Звонки работают только в установленном приложении (не в Expo Go). Соберите dev-build.');
      return;
    }
    await call.startCall({ id: partnerId, name: partnerName, avatar: params.avatar || '' }, { video });
    router.push({
      pathname: '/(app)/call/[id]',
      params: { id: String(partnerId), name: partnerName, avatar: params.avatar || '', video: video ? 'true' : 'false' },
    });
  };

  const visible = messages.filter((m) => !m.isDeleted);
  // Inverted list renders newest-first, so the latest message is at the bottom
  // with no scrolling on entry. Reverse a copy for display only.
  const data = [...visible].reverse();
  // Only own messages can be deleted, so only those are selectable.
  const selectableIds = visible.filter((m) => Number(m.fromUserId) === me).map((m) => Number(m.id));

  const copySelected = () => {
    const texts = visible
      .filter((m) => sel.selected.has(Number(m.id)) && m.text && m.text.trim())
      .map((m) => m.text!.trim());
    if (texts.length) Clipboard.setStringAsync(texts.join('\n'));
    sel.exit();
  };

  const forwardSelected = () => {
    const payloads: ForwardPayload[] = visible
      .filter((m) => sel.selected.has(Number(m.id)))
      .map((m) => ({
        id: Number(m.id),
        sourceType: 'direct' as const,
        text: m.text,
        type: m.type,
        fileUrl: m.fileUrl ?? null,
        filename: m.filename ?? null,
        senderUsername: m.forwardedFromUsername || (Number(m.fromUserId) === me ? (user?.username || '') : partnerName),
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
          ids.forEach((id) => {
            messagesApi.remove(id).catch(() => {});
            socket.emit('deleteMessage', { roomName: `chat_${chatKey}`, messageId: id });
          });
          sel.exit();
        },
      },
    ]);
  };

  return (
    <AuroraBackground palette={c}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* Header */}
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
        <Pressable hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)'))} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Pressable
          hitSlop={4}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
          onPress={() => router.push({ pathname: '/(app)/user/[id]', params: { id: String(partnerId), name: partnerName, avatar: params.avatar || '' } })}
        >
          <Avatar name={partnerName} src={params.avatar} size={42} online={online} palette={c} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.headerName}>{partnerName}</Text>
            <Text style={[styles.headerStatus, (typing || online) && { color: typing ? c.accent : c.online }]}>
              {typing ? 'typing…' : online ? 'online' : 'offline'}
            </Text>
          </View>
        </Pressable>
        <Pressable hitSlop={8} onPress={() => placeCall(false)} style={styles.headerBtn}>
          <Ionicons name="call-outline" size={21} color={c.text} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => placeCall(true)} style={styles.headerBtn}>
          <Ionicons name="videocam-outline" size={22} color={c.text} />
        </Pressable>
      </View>
      )}

      <OfflineBanner />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
        ) : visible.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Say hello 👋</Text>
            <Text style={styles.emptyBody}>This is the start of your conversation with {partnerName}.</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            inverted
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ paddingVertical: 12 }}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingOlder ? (
                <View style={styles.olderLoader}><ActivityIndicator size="small" color={c.accent} /></View>
              ) : null
            }
            renderItem={({ item, index }) => {
              // data is newest-first, so the chronologically older message is next in the array.
              const prev = data[index + 1];
              const isOut = Number(item.fromUserId) === me;
              const sameSender = prev && Number(prev.fromUserId) === Number(item.fromUserId);
              const closeInTime = prev && new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime() < 4 * 60 * 1000;
              const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(item.createdAt);
              const grouped = !!(sameSender && closeInTime && !newDay);
              return (
                <View>
                  {newDay ? (
                    <View style={styles.daySep}><Text style={styles.dayText}>{dayLabel(item.createdAt)}</Text></View>
                  ) : null}
                  <MessageBubble
                    msg={item}
                    isOut={isOut}
                    grouped={grouped}
                    me={me}
                    palette={c}
                    myUsername={user?.username}
                    onLongPress={setSheetMsg}
                    onImagePress={setLightbox}
                    onReactToggle={reactTo}
                    onRetry={retryMessage}
                    onReply={setReplyTo}
                    onShowReactors={setReactorsMsg}
                    selectionMode={sel.active}
                    selected={sel.isSelected(Number(item.id))}
                    selectable={isOut}
                    onToggleSelect={(m) => sel.toggle(Number(m.id))}
                  />
                </View>
              );
            }}
          />
        )}

        {typing ? (
          <View style={styles.typingRow}>
            <Avatar name={partnerName} src={params.avatar} size={26} palette={c} />
            <View style={styles.typingBubble}>
              <Text style={styles.typingDots}>•••</Text>
            </View>
          </View>
        ) : null}

        {uploadPct !== null ? (
          <View style={styles.uploadChip}>
            <ActivityIndicator size="small" color={c.accent} />
            <Text style={styles.uploadText}>Uploading…</Text>
          </View>
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
              draftKey={Number.isFinite(me) ? `draft.${me}.chat.${partnerId}` : null}
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
        onReact={(emoji) => sheetMsg && reactTo(sheetMsg, emoji)}
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
        resolveName={(id) => (id === me ? t('feed.you') : partnerName)}
        resolveAvatar={(id) => (id === me ? undefined : (params.avatar || undefined))}
        onClose={() => setReactorsMsg(null)}
      />

      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)} statusBarTranslucent>
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          {lightbox ? <Image source={{ uri: lightbox }} style={styles.lightboxImg} contentFit="contain" /> : null}
          <View style={[styles.lightboxClose, { top: insets.top + 12 }]}>
            <Ionicons name="close" size={28} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </AuroraBackground>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 14,
    marginHorizontal: 10, marginTop: 4,
    backgroundColor: c.glass2, borderRadius: radius.xl, borderWidth: 1, borderColor: c.stroke,
    ...shadow.soft,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerName: { color: c.text, fontFamily: font.displayMed, fontSize: 18, letterSpacing: -0.3 },
  headerStatus: { color: c.textFaint, fontFamily: font.body, fontSize: 12.5, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyTitle: { color: c.text, fontFamily: font.display, fontSize: 22 },
  emptyBody: { color: c.textDim, fontFamily: font.body, fontSize: 15, textAlign: 'center' },
  olderLoader: { paddingVertical: 14, alignItems: 'center' },
  daySep: { alignItems: 'center', marginVertical: 12 },
  dayText: {
    color: c.textDim, fontFamily: font.bodyMed, fontSize: 12, backgroundColor: c.glass2,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, overflow: 'hidden',
    borderWidth: 1, borderColor: c.stroke,
  },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 6 },
  typingBubble: { backgroundColor: c.bubbleIn, borderWidth: 1, borderColor: c.stroke, borderRadius: radius.xl, paddingHorizontal: 16, paddingVertical: 8 },
  typingDots: { color: c.textDim, fontSize: 16, letterSpacing: 2 },
  uploadChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', backgroundColor: c.glass2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 4 },
  uploadText: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 13 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '100%', height: '80%' },
  lightboxClose: { position: 'absolute', right: 18 },
});
