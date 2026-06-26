import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
  Pressable, Text, Alert, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { BrandMark } from '@/components/ui/BrandMark';
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
import { TopProgressBar } from '@/components/ui/TopProgressBar';
import { useAuth } from '@/state/auth';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';
import { useSocket } from '@/state/socket';
import { font, radius, Palette } from '@/theme/theme';

// Skip the on-focus network refetch if we already have data and refreshed within
// this window — keeps tab switches instant instead of reloading every time.
const REFRESH_THROTTLE_MS = 30_000;

export default function ChatsScreen() {
  const { user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { c, scheme } = useTheme();
  const isFocused = useIsFocused();
  const styles = useMemo(() => makeStyles(c), [c]);
  const me = Number(user?.userId);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bgRefreshing, setBgRefreshing] = useState(false);
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

  // Mirror current chats + last successful network refresh into refs so `load`
  // can stay referentially stable (deps: [me]) while still reading live values.
  const chatsRef = useRef<ChatSummary[]>([]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  const lastLoadRef = useRef(0);

  // ── load chats (online → API + cache; offline → local SQLite) ─────────────
  const load = useCallback(async (force = false) => {
    if (!Number.isFinite(me)) { setLoading(false); setRefreshing(false); return; }
    const key = cacheKeys.chats(me);
    const showCached = async () => {
      const cached = await cacheGet<ChatSummary[]>(key);
      if (!cached?.length) return;
      // Never clobber data already on screen (e.g. a fresh network result that
      // arrived before this cache read resolved).
      setChats((prev) => (prev.length ? prev : cached));
      setOnlineIds((prev) => (prev.size ? prev : new Set()));
      // Reveal the cached list immediately — the network refresh now happens
      // behind a thin top bar instead of a blocking full-screen spinner.
      setLoading(false);
    };
    // Paint instantly from cache when the screen has nothing yet, so a cold start
    // (or first visit to the tab) never shows a blank spinner — Telegram-style.
    // Fire-and-forget: must NOT block the network path (SQLite is unavailable on
    // web and would otherwise hang load() forever).
    if (chatsRef.current.length === 0) void showCached();
    // Already have data and refreshed recently → skip the network hit on focus.
    // Pull-to-refresh and socket reconnect pass force=true to always refetch.
    if (!force && chatsRef.current.length > 0 && Date.now() - lastLoadRef.current < REFRESH_THROTTLE_MS) {
      setLoading(false); setRefreshing(false);
      return;
    }
    // Offline: don't touch the API, read the local DB.
    if (!(await getIsOnline())) {
      await showCached();
      setLoading(false); setRefreshing(false);
      return;
    }
    // Background refresh indicator (thin top bar) while data is already on screen.
    setBgRefreshing(true);
    try {
      const data = await messagesApi.getChats(me);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
      setChats(list);
      setOnlineIds(new Set(list.filter((c) => c.isOnline).map((c) => Number(c.partnerId))));
      cacheSet(key, list.slice(0, 30)); // save recent chats for offline
      lastLoadRef.current = Date.now();
    } catch {
      await showCached();
    } finally { setLoading(false); setRefreshing(false); setBgRefreshing(false); }
  }, [me]);

  // Reconcile with the server when the tab regains focus (throttled inside load),
  // so actions taken elsewhere (e.g. forwarding a reel) still show up.
  useEffect(() => { if (isFocused) load(); }, [load, isFocused]);

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
        const isObj = typeof lastMessage === 'object' && lastMessage !== null;
        patch.lastMessage = isObj ? (lastMessage?.text ?? '') : lastMessage;
        patch.lastMessageType = (isObj ? lastMessage?.type : undefined) || 'text';
        patch.time = (isObj ? lastMessage?.createdAt : undefined) || new Date().toISOString();
        // keep the forward arrow in sync with the new message (clears a stale
        // arrow left over from a previously forwarded reel)
        if (isObj) patch.isForwarded = !!(lastMessage.forwardedFromType || lastMessage.isForwarded);
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
    // A partner changed their name/avatar — reflect it in their chat row live.
    const onProfileUpdated = ({ userId, username, nickname, avatar }: any) => {
      if (Number(userId) === me) return;
      const patch: Partial<ChatSummary> = {};
      const name = username || nickname;
      if (name) patch.username = name;
      if (avatar !== undefined) patch.picture = avatar ?? undefined;
      if (Object.keys(patch).length) upsert(Number(userId), patch, false);
    };

    // After a reconnect we may have missed lastMessageUpdated/chatUpdated events
    // while offline — pull a fresh snapshot so the list can't stay frozen.
    const onReconnect = () => load(true);

    socket.on('chatUpdated', onChatUpdated);
    socket.on('lastMessageUpdated', onLastMessage);
    socket.on('messageReceived', onReceived);
    socket.on('messagesReadByRecipient', onReadByRecipient);
    socket.on('userOnline', onUserOnline);
    socket.on('userOffline', onUserOffline);
    socket.on('chatsDeleted', onChatsDeleted);
    socket.on('profileUpdated', onProfileUpdated);
    socket.on('connect', onReconnect);
    return () => {
      socket.off('chatUpdated', onChatUpdated);
      socket.off('lastMessageUpdated', onLastMessage);
      socket.off('messageReceived', onReceived);
      socket.off('messagesReadByRecipient', onReadByRecipient);
      socket.off('userOnline', onUserOnline);
      socket.off('userOffline', onUserOffline);
      socket.off('chatsDeleted', onChatsDeleted);
      socket.off('profileUpdated', onProfileUpdated);
      socket.off('connect', onReconnect);
    };
  }, [socket, me, upsert, load]);

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
    Alert.alert(t('chats.deleteTitle'), t('chats.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
      {/* Brand lockup + screen title on a single row */}
      <View style={styles.titleRow}>
        <BrandMark palette={c} />
        <Text style={styles.title}>{t('tabs.chats')}</Text>
      </View>

      {/* Search bar — filters existing conversations */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={c.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('common.search')}
          placeholderTextColor={c.textFaint}
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={17} color={c.textFaint} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <AuroraBackground palette={c}>
      {isFocused ? <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /> : null}
      {sel.active ? (
        <SelectionBar
          count={sel.count}
          total={visibleChats.length}
          paddingTop={insets.top}
          label={t('chats.selLabel')}
          palette={c}
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
      {bgRefreshing && !loading && !refreshing ? <TopProgressBar palette={c} /> : null}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
      ) : (
        <FlatList
          data={visibleChats}
          keyExtractor={(c) => String(c.partnerId)}
          keyboardShouldPersistTaps="handled"
          windowSize={11}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          removeClippedSubviews
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
                palette={c}
                onLongPress={() => sel.enter(id)}
                onPress={() => (sel.active ? sel.toggle(id) : openChat(item))}
                onAvatarPress={sel.active ? undefined : () => router.push({ pathname: '/(app)/user/[id]', params: { id: String(id), name: item.username || '', avatar: item.picture || '' } })}
                onMute={sel.active ? undefined : () => toggleMute(id)}
                onPin={sel.active ? undefined : () => togglePin(id)}
                onDelete={sel.active ? undefined : () => removeChat(item)}
              />
            );
          }}
          ListEmptyComponent={
            query.trim() ? (
              <EmptyState
                icon="search-outline"
                title={t('common.notFound')}
                body={t('chats.noResultsBody')}
                palette={c}
              />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title={t('chats.emptyTitle')}
                body={t('chats.emptyBody')}
                palette={c}
              />
            )
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={c.accent}
            />
          }
        />
      )}

      {/* FAB */}
      {!sel.active && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 96 }]}
          onPress={() => router.push('/(app)/new-chat')}
          accessibilityLabel={t('chats.writeMessage')}
        >
          <Ionicons name="create" size={24} color={c.ink} />
        </Pressable>
      )}
    </AuroraBackground>
  );
}

const SIDE = 20;

const makeStyles = (c: Palette) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Brand lockup + title share one row.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE,
    marginBottom: 14,
  },
  title: {
    color: c.text,
    fontFamily: font.display,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 44, height: 44,
    borderRadius: radius.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search — same glass language as the conversation cards.
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 12,
    marginBottom: 4,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.stroke,
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: c.text,
    fontFamily: font.body,
    fontSize: 16,
    paddingVertical: 0,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 22,
    width: 58, height: 58,
    borderRadius: radius.xl,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.accent,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
