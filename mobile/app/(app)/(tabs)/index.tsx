import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  Pressable, Text, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { ChatRow } from '@/components/chat/ChatRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectionBar } from '@/components/ui/SelectionBar';
import { useSelection } from '@/lib/useSelection';
import { usePersistentIdSet } from '@/lib/usePersistentIdSet';
import { getDraftsFor, subscribeDrafts } from '@/lib/drafts';
import { messagesApi, ChatSummary } from '@/lib/api';
import { cacheGet, cacheSet, cacheKeys } from '@/lib/offlineCache';
import { getIsOnline } from '@/lib/net';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuth } from '@/state/auth';
import { useSocket } from '@/state/socket';
import { colors, font, radius } from '@/theme/theme';

export default function ChatsScreen() {
  const { user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = Number(user?.userId);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<number>>(() => new Set());
  const prefKey = Number.isFinite(me) && me > 0 ? `prefs.${me}` : null;
  const [muted, toggleMute] = usePersistentIdSet(prefKey && `${prefKey}.chats.muted`);
  const [pinned, togglePin] = usePersistentIdSet(prefKey && `${prefKey}.chats.pinned`);
  const sel = useSelection<number>();
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Map<string, string>>(() => new Map());

  const idsSig = chats.map((c) => Number(c.partnerId)).join(',');
  const refreshDrafts = useCallback(async () => {
    if (!Number.isFinite(me)) return;
    setDrafts(await getDraftsFor(me, 'chat', idsSig ? idsSig.split(',').map(Number) : []));
  }, [me, idsSig]);
  useEffect(() => { refreshDrafts(); return subscribeDrafts(refreshDrafts); }, [refreshDrafts]);

  // ── upsert helper ────────────────────────────────────────
  const upsert = useCallback((partnerId: number, patch: Partial<ChatSummary>, toTop = true) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => Number(c.partnerId) === Number(partnerId));
      if (idx === -1) {
        const created = { partnerId: Number(partnerId), unreadCount: 0, ...patch } as ChatSummary;
        return toTop ? [created, ...prev] : [...prev, created];
      }
      const updated = { ...prev[idx], ...patch };
      const rest = prev.filter((_, i) => i !== idx);
      return toTop ? [updated, ...rest] : [...rest.slice(0, idx), updated, ...rest.slice(idx)];
    });
  }, []);

  // ── load chats (online → API + cache; offline → local SQLite) ─────────────
  const load = useCallback(async () => {
    if (!Number.isFinite(me)) { setLoading(false); setRefreshing(false); return; }
    const key = cacheKeys.chats(me);
    const showCached = async () => {
      const cached = await cacheGet<ChatSummary[]>(key);
      if (cached?.length) { setChats(cached); setOnlineIds(new Set()); }
    };
    // Offline: don't touch the API, read the local DB.
    if (!(await getIsOnline())) {
      await showCached();
      setLoading(false); setRefreshing(false);
      return;
    }
    try {
      const data = await messagesApi.getChats(me);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
      setChats(list);
      setOnlineIds(new Set(list.filter((c) => c.isOnline).map((c) => Number(c.partnerId))));
      cacheSet(key, list.slice(0, 30)); // save recent chats for offline
    } catch {
      await showCached();
    } finally { setLoading(false); setRefreshing(false); }
  }, [me]);

  useEffect(() => { load(); }, [load]);

  // ── realtime socket listeners ────────────────────────────
  useEffect(() => {
    const onChatUpdated = ({ partnerId, partnerInfo, lastMessage, unreadCount }: any) => {
      const patch: Partial<ChatSummary> = {};
      // only overwrite user info if the event actually carried it
      if (partnerInfo) {
        const name = partnerInfo.username || partnerInfo.nickname;
        if (name) patch.username = name;
        if (partnerInfo.avatar !== undefined) patch.picture = partnerInfo.avatar ?? undefined;
      }
      // only overwrite lastMessage if the event carried a message (send event, not delete event)
      if (lastMessage !== undefined) {
        patch.lastMessage = typeof lastMessage === 'object' ? (lastMessage?.text ?? '') : lastMessage;
        patch.lastMessageType = (typeof lastMessage === 'object' ? lastMessage?.type : undefined) || 'text';
        patch.time = (typeof lastMessage === 'object' ? lastMessage?.createdAt : undefined) || new Date().toISOString();
      }
      if (unreadCount !== undefined) patch.unreadCount = unreadCount;
      upsert(partnerId, patch, lastMessage !== undefined);
    };
    const onLastMessage = ({ partnerId, lastMessage, lastMessageType, isForwarded, time }: any) => {
      // only update existing entry — don't create a skeleton row without user info
      setChats((prev) => {
        const idx = prev.findIndex((c) => Number(c.partnerId) === Number(partnerId));
        if (idx === -1) return prev;
        const updated = { ...prev[idx], lastMessage, lastMessageType: lastMessageType || 'text', isForwarded: !!isForwarded, time: time || new Date().toISOString() };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    };
    const onReceived = (m: any) => {
      if (Number(m.toUserId) !== me) return;
      const partnerId = Number(m.fromUserId);
      setChats((prev) => {
        const idx = prev.findIndex((c) => Number(c.partnerId) === partnerId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], unreadCount: (prev[idx].unreadCount || 0) + 1 };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    };
    const onReadByRecipient = ({ readerId, partnerId }: any) => {
      if (Number(readerId) === me) upsert(partnerId, { unreadCount: 0 }, false);
    };
    const onUserOnline = ({ userId }: any) => setOnlineIds((s) => new Set(s).add(Number(userId)));
    const onUserOffline = ({ userId }: any) => setOnlineIds((s) => { const n = new Set(s); n.delete(Number(userId)); return n; });
    const onChatsDeleted = ({ partnerIds }: any) => {
      const ids = new Set((partnerIds || []).map(Number));
      setChats((prev) => prev.filter((c) => !ids.has(Number(c.partnerId))));
    };

    socket.on('chatUpdated', onChatUpdated);
    socket.on('lastMessageUpdated', onLastMessage);
    socket.on('messageReceived', onReceived);
    socket.on('messagesReadByRecipient', onReadByRecipient);
    socket.on('userOnline', onUserOnline);
    socket.on('userOffline', onUserOffline);
    socket.on('chatsDeleted', onChatsDeleted);
    return () => {
      socket.off('chatUpdated', onChatUpdated);
      socket.off('lastMessageUpdated', onLastMessage);
      socket.off('messageReceived', onReceived);
      socket.off('messagesReadByRecipient', onReadByRecipient);
      socket.off('userOnline', onUserOnline);
      socket.off('userOffline', onUserOffline);
      socket.off('chatsDeleted', onChatsDeleted);
    };
  }, [socket, me, upsert]);

  const openChat = (c: ChatSummary) => {
    upsert(c.partnerId, { unreadCount: 0 }, false);
    router.push({ pathname: '/(app)/chat/[id]', params: { id: String(c.partnerId), name: c.username || 'Chat', avatar: c.picture || '' } });
  };

  const removeChat = (c: ChatSummary) => {
    setChats((prev) => prev.filter((x) => Number(x.partnerId) !== Number(c.partnerId)));
    messagesApi.deleteChats(me, [c.partnerId]).catch(() => {});
  };

  const muteSelected = () => {
    [...sel.selected].forEach((id) => { if (!muted.has(id)) toggleMute(id); });
    sel.exit();
  };

  const readSelected = () => {
    const ids = [...sel.selected];
    setChats((prev) => prev.map((c) => (sel.selected.has(Number(c.partnerId)) ? { ...c, unreadCount: 0 } : c)));
    ids.forEach((id) => {
      messagesApi.markAsRead(me, id).catch(() => {});
      socket.emit('messagesRead', { readerId: me, partnerId: id, unreadCount: 0 });
    });
    sel.exit();
  };

  const deleteSelected = () => {
    const ids = [...sel.selected];
    if (ids.length === 0) return;
    Alert.alert('Удалить чаты', `Удалить ${ids.length} ${ids.length === 1 ? 'чат' : 'чатов'}?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          const idSet = new Set(ids);
          setChats((prev) => prev.filter((x) => !idSet.has(Number(x.partnerId))));
          messagesApi.deleteChats(me, ids).catch(() => {});
          sel.exit();
        },
      },
    ]);
  };

  // Pinned chats float to the top, otherwise keep recency order.
  const orderedChats = useMemo(() => {
    const p = chats.filter((c) => pinned.has(Number(c.partnerId)));
    const r = chats.filter((c) => !pinned.has(Number(c.partnerId)));
    return [...p, ...r];
  }, [chats, pinned]);

  // Filter existing conversations by partner name (does not hit the server).
  const visibleChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderedChats;
    return orderedChats.filter((c) => (c.username || '').toLowerCase().includes(q));
  }, [orderedChats, query]);

  const renderHeader = () => (
    <View style={{ paddingTop: insets.top + 12 }}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Чаты</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push('/(app)/new-chat')}
          hitSlop={8}
          accessibilityLabel="Новый чат"
        >
          <Ionicons name="create-outline" size={20} color={colors.accent} />
        </Pressable>
      </View>

      {/* Search bar — filters existing conversations */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={17} color={colors.textFaint} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <AuroraBackground>
      {sel.active ? (
        <SelectionBar
          count={sel.count}
          total={visibleChats.length}
          paddingTop={insets.top}
          label="чатов"
          onClose={sel.exit}
          onSelectAll={() => sel.selectAll(visibleChats.map((c) => Number(c.partnerId)))}
          extraActions={[
            { icon: 'volume-mute-outline', onPress: muteSelected },
            { icon: 'checkmark-done-outline', onPress: readSelected },
          ]}
          onDelete={deleteSelected}
        />
      ) : (
        renderHeader()
      )}
      <OfflineBanner />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          data={visibleChats}
          keyExtractor={(c) => String(c.partnerId)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const id = Number(item.partnerId);
            return (
              <ChatRow
                chat={item}
                online={onlineIds.has(id)}
                muted={muted.has(id)}
                pinned={pinned.has(id)}
                selectionMode={sel.active}
                selected={sel.isSelected(id)}
                draft={drafts.get(String(id))}
                onLongPress={() => sel.enter(id)}
                onPress={() => (sel.active ? sel.toggle(id) : openChat(item))}
                onAvatarPress={sel.active ? undefined : () => router.push({ pathname: '/(app)/user/[id]', params: { id: String(id), name: item.username || '', avatar: item.picture || '' } })}
                onMute={sel.active ? undefined : () => toggleMute(id)}
                onPin={sel.active ? undefined : () => togglePin(id)}
                onDelete={sel.active ? undefined : () => removeChat(item)}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            query.trim() ? (
              <EmptyState
                icon="search-outline"
                title="Ничего не найдено"
                body="Попробуйте другое имя пользователя."
              />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="Пока нет переписок"
                body="Найдите собеседника по имени пользователя и начните новый зашифрованный чат."
              />
            )
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.accent}
            />
          }
        />
      )}

      {/* FAB */}
      {!sel.active && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 96 }]}
          onPress={() => router.push('/(app)/new-chat')}
          accessibilityLabel="Написать сообщение"
        >
          <Ionicons name="create" size={24} color={colors.ink} />
        </Pressable>
      )}
    </AuroraBackground>
  );
}

const SIDE = 20;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE,
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontFamily: font.display,
    fontSize: 34,
    letterSpacing: -0.6,
  },
  addBtn: {
    width: 44, height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: SIDE,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: font.body,
    fontSize: 16,
    paddingVertical: 0,
  },

  // List
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.stroke,
    marginLeft: SIDE + 56 + 14,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 22,
    width: 58, height: 58,
    borderRadius: radius.xl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C4DFF',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
