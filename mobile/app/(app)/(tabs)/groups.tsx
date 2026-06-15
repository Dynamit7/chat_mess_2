import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
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
import { groupsApi } from '@/lib/api';
import { cacheGet, cacheSet, cacheKeys } from '@/lib/offlineCache';
import { getIsOnline } from '@/lib/net';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuth } from '@/state/auth';
import { useSocket } from '@/state/socket';
import { colors, gradients, shadow, font, radius } from '@/theme/theme';

export default function GroupsScreen() {
  const { user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = Number(user?.userId);

  const [items, setItems] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const prefKey = Number.isFinite(me) && me > 0 ? `prefs.${me}` : null;
  const [muted, toggleMute] = usePersistentIdSet(prefKey && `${prefKey}.groups.muted`);
  const [pinned, togglePin] = usePersistentIdSet(prefKey && `${prefKey}.groups.pinned`);
  const sel = useSelection<number>();
  const [drafts, setDrafts] = useState<Map<string, string>>(() => new Map());

  const idsSig = items.map((g) => Number(g.id)).join(',');
  const refreshDrafts = useCallback(async () => {
    if (!Number.isFinite(me)) return;
    setDrafts(await getDraftsFor(me, 'group', idsSig ? idsSig.split(',').map(Number) : []));
  }, [me, idsSig]);
  useEffect(() => { refreshDrafts(); return subscribeDrafts(refreshDrafts); }, [refreshDrafts]);

  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merge = useCallback((id: number, patch: Partial<Entity>, toTop = true) => {
    setItems((prev) => {
      const idx = prev.findIndex((g) => Number(g.id) === Number(id));
      if (idx === -1) return prev;
      const updated = { ...prev[idx], ...patch };
      const rest = prev.filter((_, i) => i !== idx);
      return toTop ? [updated, ...rest] : [...rest.slice(0, idx), updated, ...rest.slice(idx)];
    });
  }, []);

  // online → API + cache; offline → local SQLite
  const load = useCallback(async () => {
    if (!Number.isFinite(me)) { setLoading(false); setRefreshing(false); return; }
    const key = cacheKeys.groups(me);
    const showCached = async () => { const c = await cacheGet<Entity[]>(key); if (c?.length) setItems(c); };
    if (!(await getIsOnline())) { await showCached(); setLoading(false); setRefreshing(false); return; }
    try {
      const [groups, unread] = await Promise.all([groupsApi.list(me), groupsApi.unreadCounts(me).catch(() => [])]);
      const map = new Map((unread || []).map((u: any) => [Number(u.groupId), u.unreadCount]));
      const list: Entity[] = (groups || []).map((g: any) => ({ ...g, unreadCount: map.get(Number(g.id)) || 0 }));
      list.sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());
      setItems(list);
      cacheSet(key, list.slice(0, 30)); // save recent groups for offline
    } catch {
      await showCached();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const q = query.trim();
    if (!q) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const data = await groupsApi.list(me, q);
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
      const gid = Number(d.groupId);
      merge(gid, {
        lastMessage: d.lastMessage,
        lastMessageType: d.lastMessageType || 'text',
        lastMessageSender: d.lastMessageSender,
        lastMessageTime: d.lastMessageTime || new Date().toISOString(),
        lastMessageIsForwarded: !!d.lastMessageIsForwarded,
      });
      if (d.unreadCount !== undefined) {
        // deletion event — backend sends exact recalculated count
        setItems((prev) => prev.map((g) => Number(g.id) === gid ? { ...g, unreadCount: d.unreadCount } : g));
      } else if (d.senderId && Number(d.senderId) !== me) {
        // new message from someone else
        setItems((prev) => prev.map((g) => Number(g.id) === gid ? { ...g, unreadCount: (g.unreadCount || 0) + 1 } : g));
      }
    };
    const reload = () => load();
    const onRemoved = ({ groupId }: any) => setItems((prev) => prev.filter((g) => Number(g.id) !== Number(groupId)));
    const onUpdated = ({ groupId, updatedFields }: any) => merge(groupId, updatedFields || {}, false);
    socket.on('newGroupMessage', onNew);
    socket.on('groupAdded', reload);
    socket.on('groupCreated', reload);
    socket.on('groupRemoved', onRemoved);
    socket.on('groupUpdated', onUpdated);
    return () => {
      socket.off('newGroupMessage', onNew);
      socket.off('groupAdded', reload);
      socket.off('groupCreated', reload);
      socket.off('groupRemoved', onRemoved);
      socket.off('groupUpdated', onUpdated);
    };
  }, [socket, me, merge, load]);

  const removeItem = (id: number) => setItems((prev) => prev.filter((g) => Number(g.id) !== id));

  const muteSelected = () => {
    [...sel.selected].forEach((id) => { if (!muted.has(id)) toggleMute(id); });
    sel.exit();
  };

  const readSelected = () => {
    const ids = [...sel.selected];
    setItems((prev) => prev.map((g) => (sel.selected.has(Number(g.id)) ? { ...g, unreadCount: 0 } : g)));
    ids.forEach((id) => groupsApi.updateLastSeen(id, me).catch(() => {}));
    sel.exit();
  };

  const deleteSelected = () => {
    const ids = [...sel.selected];
    if (ids.length === 0) return;
    Alert.alert('Удалить группы', `Удалить ${ids.length} ${ids.length === 1 ? 'группу' : 'групп'} из списка?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          const idSet = new Set(ids);
          setItems((prev) => prev.filter((g) => !idSet.has(Number(g.id))));
          sel.exit();
        },
      },
    ]);
  };

  const orderedItems = useMemo(() => {
    const p = items.filter((g) => pinned.has(Number(g.id)));
    const r = items.filter((g) => !pinned.has(Number(g.id)));
    return [...p, ...r];
  }, [items, pinned]);

  const open = (g: Entity) => {
    merge(g.id, { unreadCount: 0 }, false);
    router.push({ pathname: '/(app)/group/[id]', params: { id: String(g.id), name: g.name, avatar: g.avatar || '', ownerId: String((g as any).ownerId ?? ''), isMember: String((g as any).isMember !== false) } });
  };

  const closeSearch = () => { setShowSearch(false); setQuery(''); setSearchResults([]); };

  const isSearchMode = showSearch && query.trim().length > 0;
  const displayData = isSearchMode ? searchResults : orderedItems;

  return (
    <AuroraBackground>
      {sel.active ? (
        <SelectionBar
          count={sel.count}
          total={orderedItems.length}
          paddingTop={insets.top}
          label="групп"
          onClose={sel.exit}
          onSelectAll={() => sel.selectAll(orderedItems.map((g) => Number(g.id)))}
          extraActions={[
            { icon: 'volume-mute-outline', onPress: muteSelected },
            { icon: 'checkmark-done-outline', onPress: readSelected },
          ]}
          onDelete={deleteSelected}
        />
      ) : (
        <ScreenHeader
          title="Группы"
          subtitle={showSearch ? 'Поиск групп' : (items.length ? `${items.length} ${items.length === 1 ? 'группа' : 'групп'}` : 'Общайтесь сразу со многими')}
          actions={[
            { icon: showSearch ? 'close' : 'search', onPress: showSearch ? closeSearch : () => setShowSearch(true) },
            { icon: 'add', onPress: () => router.push('/(app)/create/group') },
          ]}
        />
      )}

      {showSearch && !sel.active && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Найти группу по названию..."
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          )}
        </View>
      )}

      <OfflineBanner />

      {loading && !showSearch ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : isSearchMode && searching ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : isSearchMode && searchResults.length === 0 ? (
        <EmptyState icon="sad-outline" title="Ничего не найдено" body="Попробуйте другое название группы." />
      ) : !isSearchMode && items.length === 0 ? (
        <EmptyState icon="people-outline" title="Пока нет групп" body="Создайте группу или найдите её через поиск." />
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(g) => String(g.id)}
          renderItem={({ item }) => {
            const id = Number(item.id);
            return (
              <EntityRow
                entity={item}
                kind="group"
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
              ? <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />
              : undefined
          }
        />
      )}

      {!showSearch && !sel.active && (
        <Pressable style={[styles.fab, { bottom: insets.bottom + 92 }]} onPress={() => router.push('/(app)/create/group')}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fabInner, shadow.glow]}>
            <Ionicons name="add" size={30} color={colors.ink} />
          </LinearGradient>
        </Pressable>
      )}
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.stroke, marginLeft: 16 + 54 + 14 },
  fab: { position: 'absolute', right: 22 },
  fabInner: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.stroke,
    borderRadius: radius.md, paddingHorizontal: 14, height: 46,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: font.body, fontSize: 15 },
});
