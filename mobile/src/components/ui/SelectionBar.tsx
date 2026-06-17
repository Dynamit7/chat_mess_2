import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, Palette } from '@/theme/theme';

/**
 * Top bar shown while a screen is in multi-select mode. Mirrors the height of the
 * screens' own headers (top inset + 8 padding) so swapping it in is seamless.
 * Left: close. Middle: live count. Right: optional select-all + delete.
 */
export function SelectionBar({
  count,
  total,
  onClose,
  onSelectAll,
  onDelete,
  extraActions,
  paddingTop = 0,
  label = 'выбрано',
  palette = colors,
}: {
  count: number;
  total?: number;
  onClose: () => void;
  onSelectAll?: () => void;
  onDelete: () => void;
  /** Optional actions (forward, copy, mute, mark-read…) shown before the delete button. */
  extraActions?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; disabled?: boolean }[];
  paddingTop?: number;
  label?: string;
  palette?: Palette;
}) {
  const allSelected = total !== undefined && total > 0 && count >= total;
  return (
    <View style={[styles.bar, { paddingTop: paddingTop + 8, borderBottomColor: palette.stroke }]}>
      <Pressable hitSlop={8} onPress={onClose} style={styles.iconBtn}>
        <Ionicons name="close" size={26} color={palette.text} />
      </Pressable>

      <Text style={[styles.count, { color: palette.text }]} numberOfLines={1}>
        {count} {label}
      </Text>

      <View style={{ flex: 1 }} />

      {onSelectAll ? (
        <Pressable hitSlop={8} onPress={onSelectAll} style={styles.iconBtn}>
          <Ionicons
            name={allSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={allSelected ? palette.accent : palette.text}
          />
        </Pressable>
      ) : null}

      {(extraActions || []).map((a, i) => (
        <Pressable
          key={i}
          hitSlop={8}
          onPress={a.onPress}
          disabled={count === 0 || a.disabled}
          style={[styles.iconBtn, (count === 0 || a.disabled) && { opacity: 0.4 }]}
        >
          <Ionicons name={a.icon} size={22} color={palette.text} />
        </Pressable>
      ))}

      <Pressable
        hitSlop={8}
        onPress={onDelete}
        disabled={count === 0}
        style={[styles.iconBtn, count === 0 && { opacity: 0.4 }]}
      >
        <Ionicons name="trash" size={22} color={palette.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: font.bodySemi, fontSize: 17, marginLeft: 2 },
});
