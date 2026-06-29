import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, Pressable,
  TextInput, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { KeyboardProvider, KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { usersApi } from '@/lib/api';
import { font, radius, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';

export type PickUser = { id: number; username?: string; nickname?: string; avatar?: string };

type Props = {
  visible: boolean;
  /** Current user — used to search and to exclude self from results. */
  myId: number;
  title?: string;
  /** User ids already in the group/channel — hidden from the results. */
  excludeIds?: number[];
  onClose: () => void;
  /** Adds the picked user. Resolve to keep the sheet open for more picks. */
  onPick: (user: PickUser) => Promise<void> | void;
};

export function AddMembersSheet({ visible, myId, title, excludeIds = [], onClose, onPick }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { c } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset transient state every time the sheet reopens.
  useEffect(() => {
    if (visible) { setQuery(''); setResults([]); setTouched(false); setAdded(new Set()); }
  }, [visible]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setTouched(true);
    debounce.current = setTimeout(async () => {
      try {
        const data = await usersApi.search(q, myId);
        const list: PickUser[] = (Array.isArray(data) ? data : data?.users || []).map((u: any) => ({
          id: Number(u.id ?? u.userId),
          username: u.username,
          nickname: u.nickname,
          avatar: u.avatar,
        }));
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, myId]);

  const exclude = useMemo(() => new Set(excludeIds.map(Number)), [excludeIds]);
  const visibleResults = results.filter((u) => u.id !== myId && !exclude.has(u.id));

  const pick = useCallback(async (u: PickUser) => {
    if (busyId || added.has(u.id)) return;
    setBusyId(u.id);
    try {
      await onPick(u);
      setAdded((prev) => new Set(prev).add(u.id));
    } catch {
      // parent surfaces errors; keep the row tappable for a retry
    } finally {
      setBusyId(null);
    }
  }, [busyId, added, onPick]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* A RN core Modal renders in its own Android window, so the root
          KeyboardProvider doesn't reach it. Since the app runs keyboard-controller
          in global (adjustNothing) mode, an un-wrapped Modal leaves its TextInput
          unable to take input / shows no keyboard. Nest a provider here (the
          documented fix) and lift the sheet above the keyboard so results stay
          visible. */}
      <KeyboardProvider>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding" pointerEvents="box-none">
      <Animated.View entering={SlideInDown.duration(220)} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title ?? t('members.add')}</Text>
          <Pressable hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={22} color={c.textDim} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={c.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('members.search')}
            placeholderTextColor={c.textFaint}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={c.textFaint} />
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={c.accent} size="large" /></View>
        ) : visibleResults.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name={touched ? 'sad-outline' : 'search-outline'} size={36} color={c.textFaint} />
            <Text style={styles.empty}>{touched ? t('members.noneFound') : t('members.enterName')}</Text>
          </View>
        ) : (
          <FlatList
            data={visibleResults}
            keyExtractor={(u) => String(u.id)}
            style={[styles.list, { maxHeight: screenH * 0.5 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: u }) => {
              const name = u.username || u.nickname || `User ${u.id}`;
              const isAdded = added.has(u.id);
              const isBusy = busyId === u.id;
              return (
                <Pressable
                  onPress={() => pick(u)}
                  disabled={isAdded || isBusy}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.glass }]}
                >
                  <Avatar name={name} src={u.avatar} size={46} palette={c} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                    {u.nickname && u.username !== u.nickname ? (
                      <Text style={styles.rowSub} numberOfLines={1}>@{u.nickname}</Text>
                    ) : null}
                  </View>
                  {isBusy ? (
                    <ActivityIndicator size="small" color={c.accent} />
                  ) : isAdded ? (
                    <Ionicons name="checkmark-circle" size={24} color={c.accent} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color={c.accent} />
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </Animated.View>
      </KeyboardAvoidingView>
      </KeyboardProvider>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: c.bg2 ?? '#12102A',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderWidth: 1, borderColor: c.stroke,
    maxHeight: '82%',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.stroke2 ?? c.stroke, marginTop: 10, marginBottom: 2,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { color: c.text, fontFamily: font.bodySemi, fontSize: 17 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.glass, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 9,
    marginHorizontal: 14, marginVertical: 10,
    borderWidth: 1, borderColor: c.stroke,
  },
  searchInput: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 15, padding: 0 },
  // No `flex: 1`: the sheet is content-sized (maxHeight: '82%'), so a flex child
  // would collapse to height 0 and the results would be invisible/untappable.
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.md, marginHorizontal: 6,
  },
  rowName: { color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  rowSub: { color: c.textFaint, fontFamily: font.body, fontSize: 12, marginTop: 1 },
  center: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { color: c.textFaint, fontFamily: font.body, fontSize: 14 },
});
