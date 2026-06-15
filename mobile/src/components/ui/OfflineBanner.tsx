import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsOnline } from '@/lib/net';
import { colors, font } from '@/theme/theme';

/** Thin strip shown while offline so the user knows the data is from local cache. */
export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={15} color={colors.warning} />
      <Text style={styles.text}>Нет интернета — показаны сохранённые данные</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: 'rgba(255,214,10,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,214,10,0.30)',
  },
  text: { color: colors.warning, fontFamily: font.bodyMed, fontSize: 12.5 },
});
