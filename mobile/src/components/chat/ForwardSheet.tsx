import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, Pressable,
  TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { messagesApi, groupsApi, channelsApi, ForwardPayload } from '@/lib/api';
import { colors, font, gradients, radius } from '@/theme/theme';

type Tab = 'chats' | 'groups' | 'channels';

type Dest = {
  type: 'direct' | 'group' | 'channel';
  id: number;
  name: string;
  avatar?: string | null;
};

type Props = {
  visible: boolean;
  /** Single message (legacy) or several for multi-forward. */
  message?: ForwardPayload | null;
  messages?: ForwardPayload[];
  userId: number;
  onClose: () => void;
};

export function ForwardSheet({ visible, message, messages, userId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('chats');
  const [query, setQuery] = useState('');
  const [allChats, setAllChats] = useState<Dest[]>([]);
  const [allGroups, setAllGroups] = useState<Dest[]>([]);
  const [allChannels, setAllChannels] = useState<Dest[]>([]);
  const [selected, setSelected] = useState<Dest[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sending, setSending] = useState(false);
  const prevVisible = useRef(false);

  // Reload every time sheet opens
  useEffect(() => {
    if (!visible || prevVisible.current || !userId) return;
    prevVisible.current = true;
    setLoadingData(true);
    Promise.all([
      messagesApi.getChats(userId).catch(() => []),
      groupsApi.list(userId).catch(() => []),
      channelsApi.list(userId).catch(() => []),
    ]).then(([c, g, ch]) => {
      // ChatSummary: { partnerId, username, picture }
      setAllChats(
        (Array.isArray(c) ? c : [])
          .filter((x: any) => x.partnerId)
          .map((x: any) => ({
            type: 'direct' as const,
            id: Number(x.partnerId),
            name: x.username || x.nickname || `User ${x.partnerId}`,
            avatar: x.picture || x.avatar || null,
          }))
      );
      // Group: { id, name, avatar }
      setAllGroups(
        (Array.isArray(g) ? g : [])
          .filter((x: any) => x.id)
          .map((x: any) => ({
            type: 'group' as const,
            id: Number(x.id),
            name: x.name || 'Группа',
            avatar: x.avatar || null,
          }))
      );
      // Channel: { id, name, avatar }
      setAllChannels(
        (Array.isArray(ch) ? ch : [])
          .filter((x: any) => x.id)
          .map((x: any) => ({
            type: 'channel' as const,
            id: Number(x.id),
            name: x.name || 'Канал',
            avatar: x.avatar || null,
          }))
      );
    }).finally(() => setLoadingData(false));
  }, [visible, userId]);

  // Reset when sheet closes
  useEffect(() => {
    if (!visible) prevVisible.current = false;
  }, [visible]);

  const close = useCallback(() => {
    setSelected([]);
    setQuery('');
    setTab('chats');
    onClose();
  }, [onClose]);

  const toggle = (dest: Dest) => {
    setSelected((prev) => {
      const exists = prev.some((d) => d.type === dest.type && d.id === dest.id);
      return exists
        ? prev.filter((d) => !(d.type === dest.type && d.id === dest.id))
        : [...prev, dest];
    });
  };

  const payloads: ForwardPayload[] = messages && messages.length ? messages : message ? [message] : [];

  const send = async () => {
    if (payloads.length === 0 || selected.length === 0) return;
    setSending(true);
    try {
      const destinations = selected.map((d) => ({ type: d.type, id: d.id }));
      // Backend forwards one source message at a time → loop over the picked messages.
      for (const p of payloads) {
        await messagesApi.forward({ userId, sourceMessage: p, destinations });
      }
      close();
    } catch {
      // silent — toast can be added later
    } finally {
      setSending(false);
    }
  };

  const currentList: Dest[] =
    tab === 'chats' ? allChats : tab === 'groups' ? allGroups : allChannels;

  const filtered = query.trim()
    ? currentList.filter((d) =>
        d.name.toLowerCase().includes(query.toLowerCase().trim())
      )
    : currentList;

  const TABS: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'chats',    label: 'Чаты',    icon: 'chatbubble-outline', count: allChats.length },
    { key: 'groups',   label: 'Группы',  icon: 'people-outline',     count: allGroups.length },
    { key: 'channels', label: 'Каналы',  icon: 'megaphone-outline',  count: allChannels.length },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={close} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{payloads.length > 1 ? `Переслать ${payloads.length} сообщений` : 'Переслать сообщение'}</Text>
          <Pressable hitSlop={12} onPress={close}>
            <Ionicons name="close" size={22} color={colors.textDim} />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => { setTab(t.key); setQuery(''); }}
                style={styles.tabBtn}
              >
                <Ionicons
                  name={t.icon}
                  size={15}
                  color={active ? colors.accent : colors.textFaint}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {t.label}
                  {t.count > 0 ? ` ${t.count}` : ''}
                </Text>
                {active && <View style={styles.tabUnderline} />}
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск…"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textFaint} />
            </Pressable>
          )}
        </View>

        {/* List */}
        {loadingData ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={36} color={colors.textFaint} />
            <Text style={styles.empty}>
              {query.trim() ? 'Ничего не найдено' : 'Нет элементов'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(d) => `${d.type}_${d.id}`}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: d, index }) => {
              const checked = selected.some(
                (s) => s.type === d.type && s.id === d.id
              );
              return (
                <Pressable
                  onPress={() => toggle(d)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: colors.glass },
                  ]}
                >
                  <Avatar name={d.name} src={d.avatar} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{d.name}</Text>
                    <Text style={styles.rowType}>
                      {d.type === 'direct' ? 'Чат' : d.type === 'group' ? 'Группа' : 'Канал'}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                    {checked && (
                      <Ionicons name="checkmark" size={14} color={colors.ink} />
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* Send bar */}
        {selected.length > 0 && (
          <View style={styles.sendBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sendCount}>
                Выбрано: {selected.length}
              </Text>
              <Text style={styles.sendNames} numberOfLines={1}>
                {selected.map((d) => d.name).join(', ')}
              </Text>
            </View>
            <Pressable
              onPress={send}
              disabled={sending}
              style={({ pressed }) => ({ opacity: pressed || sending ? 0.7 : 1 })}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtn}
              >
                {sending
                  ? <ActivityIndicator size="small" color={colors.ink} />
                  : <Ionicons name="send" size={20} color={colors.ink} />
                }
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },

  sheet: {
    backgroundColor: colors.bg2 ?? '#12102A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: colors.stroke,
    maxHeight: '82%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.stroke2 ?? colors.stroke,
    marginTop: 10, marginBottom: 2,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { color: colors.text, fontFamily: font.bodySemi, fontSize: 17 },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11,
    position: 'relative',
  },
  tabLabel: { color: colors.textFaint, fontFamily: font.bodyMed, fontSize: 13 },
  tabLabelActive: { color: colors.accent },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 8, right: 8,
    height: 2, backgroundColor: colors.accent, borderRadius: 1,
  },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 9,
    marginHorizontal: 14, marginVertical: 10,
    borderWidth: 1, borderColor: colors.stroke,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: font.body,
    fontSize: 15,
    padding: 0,
  },

  list: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.md,
    marginHorizontal: 6,
  },
  rowName: { color: colors.text, fontFamily: font.bodyMed, fontSize: 15 },
  rowType: { color: colors.textFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },

  checkbox: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: colors.stroke,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },

  sendBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.stroke,
    marginTop: 4,
  },
  sendCount: { color: colors.text, fontFamily: font.bodySemi, fontSize: 14 },
  sendNames: { color: colors.textFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },
  sendBtn: {
    width: 50, height: 50,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  center: { height: 200, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { color: colors.textFaint, fontFamily: font.body, fontSize: 14 },
});
