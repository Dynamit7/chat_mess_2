import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SelectionBar } from '@/components/ui/SelectionBar';
import { EntityRow, Entity } from '@/components/social/EntityRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSelection } from '@/lib/useSelection';
import { usePersistentIdSet } from '@/lib/usePersistentIdSet';
import { getDraftsFor, subscribeDrafts } from '@/lib/drafts';
import { channelsApi } from '@/lib/api';
import { cacheGet, cacheSet, cacheKeys } from '@/lib/offlineCache';
import { getIsOnline } from '@/lib/net';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuth } from '@/state/auth';
import { useSocket } from '@/state/socket';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';
import { gradients, shadow, font, radius, Palette } from '@/theme/theme';

// Skip the on-focus network refetch if we already have data and refreshed within
// this window — keeps tab switches instant instead of reloading every time.
const REFRESH_THROTTLE_MS = 30_000;

export default function ChannelsScreen() {
  const { user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { c, scheme } = useTheme();
  const isFocused = useIsFocused();
  const styles = useMemo(() => makeStyles(c), [c]);
  const me = Number(user?.userId);

  const [items, setItems] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const prefKey = Number.isFinite(me) && me > 0 ? `prefs.${me}` : null;
  const [muted, toggleMute] = usePersistentIdSet(prefKey && `${prefKey}.channels.muted`);
  const [pinned, togglePin] = usePersistentIdSet(prefKey && `${prefKey}.channels.pinned`);
  const sel = useSelection<number>();
  const [drafts, setDrafts] = useState<Map<string, string>>(() => new Map());

  const idsSig = items.map((c) => Number(c.id)).join(',');
  const refreshDrafts = useCallback(async () => {
    if (!Number.isFinite(me)) return;
    setDrafts(await getDraftsFor(me, 'channel', idsSig ? idsSig.split(',').map(Number) : []));
  }, [me, idsSig]);
  useEffect(() => { refreshDrafts(); return subscribeDrafts(refreshDrafts); }, [refreshDrafts]);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merge = useCallback((id: number, patch: Partial<Entity>, toTop = true) => {
    setItems((prev) => {
      const idx = prev.findIndex((c) => Number(c.id) === Number(id));
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...patch };
      const rest = prev.filter((_, i) => i !== idx);
      return toTop ? [updated, ...rest] : [...rest.slice(0, idx), updated, ...rest.slice(idx)];
    });
  }, []);

  // Mirror current items + last successful network refresh into refs so `load`
  // can stay referentially stable (deps: [me]) while still reading live values.
  const itemsRef = useRef<Entity[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const lastLoadRef = useRef(0);

  // online → API + cache; offline → local SQLite
  const load = useCallback(async (force = false) => {
    if (!Number.isFinite(me)) { setLoading(false); setRefreshing(false); return; }
    const key = cacheKeys.channels(me);
    // Never clobber data already on screen (e.g. a fresh network result that
    // arrived before this cache read resolved).
    const showCached = async () => { const c = await cacheGet<Entity[]>(key); if (c?.length) setItems((prev) => (prev.length ? prev : c)); };
    // Paint instantly from cache when the screen has nothing yet (cold start /
    // first visit) so switching to this tab never shows a blank spinner.
    // Fire-and-forget: must NOT block the network path (SQLite is unavailable on
    // web and would otherwise hang load() forever).
    if (itemsRef.current.length === 0) void showCached();
    // Already have data and refreshed recently → skip the network hit on focus.
    if (!force && itemsRef.current.length > 0 && Date.now() - lastLoadRef.current < REFRESH_THROTTLE_MS) {
      setLoading(false); setRefreshing(false);
      return;
    }
    if (!(await getIsOnline())) { await showCached(); setLoading(false); setRefreshing(false); return; }
    try {
      const [channels, unread] = await Promise.all([channelsApi.list(me), channelsApi.unreadCounts(me).catch(() => [])]);
      const map = new Map((unread || []).map((u: any) => [Number(u.channelId), u.unreadCount]));
      const list: Entity[] = (channels || []).map((c: any) => ({ ...c, unreadCount: map.get(Number(c.id)) || 0 }));
      list.sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());
      setItems(list);
      cacheSet(key, list.slice(0, 30)); // save recent channels for offline
      lastLoadRef.current = Date.now();
    } catch {
      await showCached();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me]);

  // Reconcile with the server on focus (throttled inside load), so a freshly
  // created channel always shows up.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const q = query.trim();
    if (!q) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const data = await channelsApi.list(me, q);
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [query, me]);

  useEffect(() => {
    const onNew = (d: any) => {
      // ignore comments (replies to posts) — they don't change lastMessage in the list
      if (d.parentMessageId) return;
      const cid = Number(d.channelId);
      merge(cid, {
        lastMessage: d.text || '',
        lastMessageType: d.type || 'text',
        lastMessageSender: d.sender?.username,
        lastMessageTime: d.createdAt || new Date().toISOString(),
        lastMessageIsForwarded: !!d.forwardedFromType,
      });
      if (Number(d.userId) !== me) {
        setItems((prev) =>
          prev.map((c) => Number(c.id) === cid ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c)
        );
      }
    };
    // fired after a message is deleted — carries the new lastMessage + recalculated unreadCount
    const onLastMsgUpdated = (d: any) => {
      const cid = Number(d.channelId);
      merge(cid, {
        lastMessage: d.lastMessage ?? '',
        lastMessageType: d.lastMessageType || 'text',
        lastMessageTime: d.lastMessageTime || '',
      }, false);
      if (d.unreadCount !== undefined) {
        setItems((prev) =>
          prev.map((c) => Number(c.id) === cid ? { ...c, unreadCount: d.unreadCount } : c)
        );
      }
    };
    const reload = () => load(true);
    const onRemoved = ({ channelId }: any) => setItems((prev) => prev.filter((c) => Number(c.id) !== Number(channelId)));
    const onUpdated = ({ channelId, updatedFields }: any) => merge(channelId, updatedFields || {}, false);
    socket.on('channelMessageReceived', onNew);
    socket.on('channelLastMessageUpdated', onLastMsgUpdated);
    socket.on('channelCreated', reload);
    socket.on('channelAdded', reload);
    socket.on('channelRemoved', onRemoved);
    socket.on('channelUpdated', onUpdated);
    return () => {
      socket.off('channelMessageReceived', onNew);
      socket.off('channelLastMessageUpdated', onLastMsgUpdated);
      socket.off('channelCreated', reload);
      socket.off('channelAdded', reload);
      socket.off('channelRemoved', onRemoved);
      socket.off('channelUpdated', onUpdated);
    };
  }, [socket, me, merge, load]);

  const removeItem = (id: number) => setItems((prev) => prev.filter((c) => Number(c.id) !== id));

  const muteSelected = () => {
    [...sel.selected].forEach((id) => { if (!muted.has(id)) toggleMute(id); });
    sel.exit();
  };

  const readSelected = () => {
    const ids = [...sel.selected];
    setItems((prev) => prev.map((c) => (sel.selected.has(Number(c.id)) ? { ...c, unreadCount: 0 } : c)));
    ids.forEach((id) => channelsApi.updateLastSeen(id, me).catch(() => {}));
    sel.exit();
  };

  const deleteSelected = () => {
    const ids = [...sel.selected];
    if (ids.length === 0) return;
    Alert.alert(t('channels.deleteTitle'), t('channels.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const idSet = new Set(ids);
          setItems((prev) => prev.filter((c) => !idSet.has(Number(c.id))));
          sel.exit();
        },
      },
    ]);
  };

  const orderedItems = useMemo(() => {
    const p = items.filter((c) => pinned.has(Number(c.id)));
    const r = items.filter((c) => !pinned.has(Number(c.id)));
    return [...p, ...r];
  }, [items, pinned]);

  const open = (c: Entity) => {
    merge(c.id, { unreadCount: 0 }, false);
    router.push({ pathname: '/(app)/channel/[id]', params: { id: String(c.id), name: c.name, avatar: c.avatar || '', ownerId: String((c as any).ownerId ?? ''), isMember: String((c as any).isMember !== false), members: String(c.membersCount ?? c.subscribersCount ?? 0) } });
  };

  const closeSearch = () => { setShowSearch(false); setQuery(''); setSearchResults([]); };

  const isSearchMode = showSearch && query.trim().length > 0;
  const displayData = isSearchMode ? searchResults : orderedItems;

  return (
    <AuroraBackground palette={c}>
      {isFocused ? <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /> : null}
      {sel.active ? (
        <SelectionBar
          count={sel.count}
          total={orderedItems.length}
          paddingTop={insets.top}
          label={t('channels.selLabel')}
          palette={c}
          onClose={sel.exit}
          onSelectAll={() => sel.selectAll(orderedItems.map((c) => Number(c.id)))}
          extraActions={[
            { icon: 'volume-mute-outline', onPress: muteSelected },
            { icon: 'checkmark-done-outline', onPress: readSelected },
          ]}
          onDelete={deleteSelected}
        />
      ) : (
        <ScreenHeader
          title={t('tabs.channels')}
          subtitle={showSearch ? t('channels.searchSubtitle') : (items.length ? t('channels.count', { count: items.length }) : undefined)}
          palette={c}
          actions={[
            { icon: showSearch ? 'close' : 'search', onPress: showSearch ? closeSearch : () => setShowSearch(true) },
          ]}
        />
      )}

      {showSearch && !sel.active && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={c.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('channels.searchPlaceholder')}
            placeholderTextColor={c.textFaint}
            style={styles.searchInput}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={c.textFaint} />
            </Pressable>
          )}
        </View>
      )}

      <OfflineBanner />

      {loading && !showSearch ? (
        <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
      ) : isSearchMode && searching ? (
        <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
      ) : isSearchMode && searchResults.length === 0 ? (
        <EmptyState icon="sad-outline" title={t('common.notFound')} body={t('channels.noResultsBody')} palette={c} />
      ) : !isSearchMode && items.length === 0 ? (
        <EmptyState icon="megaphone-outline" title={t('channels.emptyTitle')} body={t('channels.emptyBody')} palette={c} />
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => {
            const id = Number(item.id);
            return (
              <EntityRow
                entity={item}
                kind="channel"
                palette={c}
                selectionMode={sel.active}
                selected={sel.isSelected(id)}
                draft={isSearchMode ? undefined : drafts.get(String(id))}
                onLongPress={isSearchMode ? undefined : () => sel.enter(id)}
                onPress={() => (sel.active ? sel.toggle(id) : open(item))}
                muted={isSearchMode || sel.active ? undefined : muted.has(id)}
                pinned={isSearchMode || sel.active ? undefined : pinned.has(id)}
                onMute={isSearchMode || sel.active ? undefined : () => toggleMute(id)}
                onPin={isSearchMode || sel.active ? undefined : () => togglePin(id)}
                onDelete={isSearchMode || sel.active ? undefined : () => removeItem(id)}
              />
            );
          }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            !isSearchMode
              ? <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={c.accent} />
              : undefined
          }
        />
      )}

      {!showSearch && !sel.active && (
        <Pressable style={[styles.fab, { bottom: insets.bottom + 92 }]} onPress={() => router.push('/(app)/create/channel')}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fabInner, shadow.glow]}>
            <Ionicons name="add" size={30} color={c.ink} />
          </LinearGradient>
        </Pressable>
      )}
    </AuroraBackground>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.stroke, marginLeft: 16 + 54 + 14 },
  fab: { position: 'absolute', right: 22 },
  fabInner: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.stroke,
    borderRadius: radius.md, paddingHorizontal: 14, height: 46,
  },
  searchInput: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 15 },
});
