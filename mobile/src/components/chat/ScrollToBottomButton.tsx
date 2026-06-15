import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow } from '@/theme/theme';

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
  if (!visible) return null;
  return (
    <Pressable onPress={onPress} style={[styles.btn, { bottom }, shadow.soft]} hitSlop={6}>
      <Ionicons name="chevron-down" size={24} color={colors.text} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute', right: 14,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.stroke,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -6, alignSelf: 'center',
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.ink, fontFamily: font.bodyBold, fontSize: 11 },
});
