import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, shadow, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';

/** Floating "jump to latest" button with an unread-since-scroll badge. */
export function ScrollToBottomButton({
  visible,
  count = 0,
  onPress,
  bottom,
}: {
  visible: boolean;
  count?: number;
  onPress: () => void;
  bottom: number;
}) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!visible) return null;
  return (
    <Pressable onPress={onPress} style={[styles.btn, { bottom }, shadow.soft]} hitSlop={6}>
      <Ionicons name="chevron-down" size={24} color={c.text} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  btn: {
    position: 'absolute', right: 14,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: c.surface2, borderWidth: 1, borderColor: c.stroke,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -6, alignSelf: 'center',
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: c.ink, fontFamily: font.bodyBold, fontSize: 11 },
});
