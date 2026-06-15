import { Modal, View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { colors, font, radius } from '@/theme/theme';

type Reaction = { userId: number; emoji: string };

/** Bottom sheet listing who reacted to a message and with which emoji. */
export function ReactionsViewer({
  visible,
  reactions,
  resolveName,
  resolveAvatar,
  onClose,
}: {
  visible: boolean;
  reactions: Reaction[];
  resolveName: (userId: number) => string;
  resolveAvatar?: (userId: number) => string | undefined;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  // Emoji summary chips (emoji × count), most used first.
  const counts = new Map<string, number>();
  reactions.forEach((r) => counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1));
  const summary = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>Реакции · {reactions.length}</Text>
          {summary.length > 0 && (
            <View style={styles.summary}>
              {summary.map(([e, n]) => (
                <View key={e} style={styles.chip}>
                  <Text style={styles.chipEmoji}>{e}</Text>
                  <Text style={styles.chipCount}>{n}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <FlatList
          data={reactions}
          keyExtractor={(r, i) => `${r.userId}_${r.emoji}_${i}`}
          style={{ maxHeight: 360 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar name={resolveName(item.userId)} src={resolveAvatar?.(item.userId)} size={38} />
              <Text style={styles.name} numberOfLines={1}>{resolveName(item.userId)}</Text>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Пока нет реакций.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: colors.stroke, paddingHorizontal: 16, paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.stroke2, marginBottom: 12 },
  head: { gap: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.stroke },
  title: { color: colors.text, fontFamily: font.bodySemi, fontSize: 16 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: colors.glass2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.stroke,
  },
  chipEmoji: { fontSize: 14 },
  chipCount: { color: colors.textDim, fontFamily: font.bodySemi, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  name: { flex: 1, color: colors.text, fontFamily: font.bodyMed, fontSize: 15 },
  emoji: { fontSize: 22 },
  empty: { color: colors.textFaint, fontFamily: font.body, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
});
