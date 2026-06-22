import { Text, StyleSheet } from 'react-native';
import { font, colors } from '@/theme/theme';

/**
 * Wordmark. (A true gradient fill needs @react-native-masked-view; we keep the
 * dependency surface small and use a crisp light wordmark instead.)
 */
export function MaskedWordmark({ text, fontSize = 32 }: { text: string; fontSize?: number }) {
  return <Text style={[styles.text, { fontSize }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontFamily: font.display, letterSpacing: 0.5 },
});
