import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, Pressable,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { KeyboardProvider, KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { messagesApi, groupsApi, channelsApi, ForwardPayload } from '@/lib/api';
import { font, gradients, radius, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';

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
  /** Fired once after the forward request(s) succeed, before the sheet closes. */
  onSent?: () => void;
};

export function ForwardSheet({ visible, message, messages, userId, onClose, onSent }: Props) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState<Tab>('chats');
  const [query, setQuery] = useState('');
  const [allChats, setAllChats] = useState<Dest[]>([]);
  const [allGroups, setAllGroups] = useState<Dest[]>([]);
  const [allChannels, setAllChannels] = useState<Dest[]>([]);
  const [selected, setSelected] = useState<Dest[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sending, setSending] = useState(false);
  const loadedRef = useRef(false);

  // Load the destination lists when the sheet opens. We key the effect on both
  // `visible` and `userId` so that if the sheet is opened before the session is
  // ready (userId still 0/NaN — e.g. forwarding straight from the feed), it
  // retries automatically once a valid id arrives, instead of staying empty.
  useEffect(() => {
    if (!visible) { loadedRef.current = false; return; }
    const uid = Number(userId);
    if (loadedRef.current || !Number.isFinite(uid) || uid <= 0) return;
    loadedRef.current = true;
    setLoadingData(true);
    // Tolerate either a bare array or a wrapped { chats|groups|channels|users } shape.
    const asArr = (d: any): any[] =>
      Array.isArray(d) ? d : d?.chats || d?.groups || d?.channels || d?.users || [];
    Promise.all([
      messagesApi.getChats(uid).catch(() => []),
      groupsApi.list(uid).catch(() => []),
      channelsApi.list(uid).catch(() => []),
    ]).then(([c, g, ch]) => {
      // ChatSummary: { partnerId, username, picture }
      setAllChats(
        asArr(c)
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
        asArr(g)
          .filter((x: any) => x.id)
          .map((x: any) => ({
            type: 'group' as const,
            id: Number(x.id),
            name: x.name || t('forward.kindGroup'),
            avatar: x.avatar || null,
          }))
      );
      // Channel: { id, name, avatar }
      setAllChannels(
        asArr(ch)
          .filter((x: any) => x.id)
          .map((x: any) => ({
            type: 'channel' as const,
            id: Number(x.id),
            name: x.name || t('forward.kindChannel'),
            avatar: x.avatar || null,
          }))
      );
    }).finally(() => setLoadingData(false));
  }, [visible, userId]);

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

  // Humanise the per-destination error codes the backend returns.
  const errLabel = (code: string) => {
    switch (code) {
      case 'blocked': return t('forward.errBlocked');
      case 'not_member': return t('forward.errNotMember');
      case 'channel_not_found': return t('common.notFound');
      default: return code || t('story.tryAgain');
    }
  };

  const send = async () => {
    if (payloads.length === 0 || selected.length === 0) return;
    setSending(true);
    try {
      const destinations = selected.map((d) => ({ type: d.type, id: d.id }));
      // The backend ALWAYS returns 200 with a per-destination `results` array — a
      // failed delivery is `results[].error`, NOT an HTTP error. So inspect it:
      // treating any 200 as success silently dropped failed forwards (looked like
      // the button did nothing).
      const failures: string[] = [];
      // Backend forwards one source message at a time → loop over the picked messages.
      for (const p of payloads) {
        const res: any = await messagesApi.forward({ userId, sourceMessage: p, destinations });
        for (const r of (res?.results || [])) {
          if (r?.error) {
            const name = selected.find((d) => d.type === r.dest?.type && d.id === r.dest?.id)?.name
              || `${r.dest?.type} #${r.dest?.id}`;
            failures.push(`${name}: ${errLabel(r.error)}`);
          }
        }
      }
      if (failures.length) {
        // Keep the sheet open so the user can retry / pick another destination.
        Alert.alert(t('forward.one'), failures.join('\n'));
        return;
      }
      onSent?.();
      close();
    } catch (e: any) {
      // Network / HTTP error (e.g. 500) — surface it instead of failing silently.
      Alert.alert(t('forward.one'), e?.response?.data?.error || e?.response?.data?.message || t('story.tryAgain'));
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
    { key: 'chats',    label: t('tabs.chats'),    icon: 'chatbubble-outline', count: allChats.length },
    { key: 'groups',   label: t('tabs.groups'),   icon: 'people-outline',     count: allGroups.length },
    { key: 'channels', label: t('tabs.channels'), icon: 'megaphone-outline',  count: allChannels.length },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      {/* Nested KeyboardProvider: a RN core Modal is a separate Android window
          the root provider doesn't reach, so without this the TextInput can't
          take input under keyboard-controller's global mode. */}
      <KeyboardProvider>
      <KeyboardAvoidingView behavior="padding" style={styles.avoider}>
      <Pressable style={styles.backdrop} onPress={close} />

      <Animated.View entering={SlideInDown.duration(220)} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{payloads.length > 1 ? t('forward.many', { count: payloads.length }) : t('forward.one')}</Text>
          <Pressable hitSlop={12} onPress={close}>
            <Ionicons name="close" size={22} color={c.textDim} />
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
                  color={active ? c.accent : c.textFaint}
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
          <Ionicons name="search-outline" size={16} color={c.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('common.search')}
            placeholderTextColor={c.textFaint}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={c.textFaint} />
            </Pressable>
          )}
        </View>

        {/* List */}
        {loadingData ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.accent} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="search-outline" size={36} color={c.textFaint} />
            <Text style={styles.empty}>
              {query.trim() ? t('common.notFound') : t('forward.noItems')}
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
                    pressed && { backgroundColor: c.glass },
                  ]}
                >
                  <Avatar name={d.name} src={d.avatar} size={46} palette={c} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{d.name}</Text>
                    <Text style={styles.rowType}>
                      {d.type === 'direct' ? t('forward.kindChat') : d.type === 'group' ? t('forward.kindGroup') : t('forward.kindChannel')}
                    </Text>
                  </View>
                  <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                    {checked && (
                      <Ionicons name="checkmark" size={14} color={c.ink} />
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
                {t('forward.selected', { count: selected.length })}
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
                  ? <ActivityIndicator size="small" color={c.ink} />
                  : <Ionicons name="send" size={20} color={c.ink} />
                }
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </Animated.View>
      </KeyboardAvoidingView>
      </KeyboardProvider>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  avoider: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  sheet: {
    backgroundColor: c.bg2 ?? '#12102A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: c.stroke,
    maxHeight: '82%',
    minHeight: '46%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: c.stroke2 ?? c.stroke,
    marginTop: 10, marginBottom: 2,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { color: c.text, fontFamily: font.bodySemi, fontSize: 17 },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.stroke,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11,
    position: 'relative',
  },
  tabLabel: { color: c.textFaint, fontFamily: font.bodyMed, fontSize: 13 },
  tabLabelActive: { color: c.accent },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 8, right: 8,
    height: 2, backgroundColor: c.accent, borderRadius: 1,
  },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.glass,
    borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 9,
    marginHorizontal: 14, marginVertical: 10,
    borderWidth: 1, borderColor: c.stroke,
  },
  searchInput: {
    flex: 1,
    color: c.text,
    fontFamily: font.body,
    fontSize: 15,
    padding: 0,
  },

  // The sheet has a bounded height (minHeight..maxHeight), so the list can flex
  // to fill it and scroll.
  list: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.md,
    marginHorizontal: 6,
  },
  rowName: { color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  rowType: { color: c.textFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },

  checkbox: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: c.stroke,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: c.accent, borderColor: c.accent },

  sendBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.stroke,
    marginTop: 4,
  },
  sendCount: { color: c.text, fontFamily: font.bodySemi, fontSize: 14 },
  sendNames: { color: c.textFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },
  sendBtn: {
    width: 50, height: 50,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  center: { height: 200, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { color: c.textFaint, fontFamily: font.body, fontSize: 14 },
});
