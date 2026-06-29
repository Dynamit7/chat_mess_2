import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, FlatList, StyleSheet,
} from 'react-native';
import { KeyboardProvider, KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, Palette } from '@/theme/theme';
import { COUNTRIES, Country, flagOf } from '@/lib/countries';
import { useT } from '@/i18n';

type Props = {
  label?: string;
  value: string;                       // the local number (digits only)
  onChangeText: (v: string) => void;
  country: Country;
  onCountryChange: (c: Country) => void;
  palette?: Palette;
  onSubmitEditing?: () => void;
};

/**
 * Telegram-style phone field: a country selector that shows the flag + dial code,
 * and a number input beside it. Tapping the dial chip opens a searchable country
 * list. The full E.164 number is `country.dial + value` — see `e164()` below.
 */
export function PhoneInput({
  label, value, onChangeText, country, onCountryChange, palette = colors, onSubmitEditing,
}: Props) {
  const c = palette;
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (x) => x.name.toLowerCase().includes(q) || x.dial.includes(q) || x.iso2.toLowerCase().includes(q),
    );
  }, [query]);

  const pick = (x: Country) => {
    onCountryChange(x);
    setPicker(false);
    setQuery('');
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Pressable style={styles.dialBtn} onPress={() => setPicker(true)} hitSlop={6}>
          <Text style={styles.flag}>{flagOf(country.iso2)}</Text>
          <Text style={styles.dial}>{country.dial}</Text>
          <Ionicons name="chevron-down" size={15} color={c.textFaint} />
        </Pressable>

        <View style={styles.divider} />

        <TextInput
          value={value}
          onChangeText={(v) => onChangeText(v.replace(/[^\d]/g, ''))}
          placeholder="00 000 00 00"
          placeholderTextColor={c.textFaint}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={15}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
        />
      </View>

      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)} statusBarTranslucent>
        {/* Nested KeyboardProvider so the search field works inside this RN Modal
            under keyboard-controller's global mode. */}
        <KeyboardProvider>
        <KeyboardAvoidingView behavior="padding" style={styles.avoider}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('auth.selectCountry')}</Text>
            <Pressable hitSlop={12} onPress={() => setPicker(false)}>
              <Ionicons name="close" size={22} color={c.textDim} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={c.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('auth.searchCountry')}
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

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.iso2}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            renderItem={({ item }) => {
              const active = item.iso2 === country.iso2;
              return (
                <Pressable style={[styles.row, active && styles.rowActive]} onPress={() => pick(item)}>
                  <Text style={styles.rowFlag}>{flagOf(item.iso2)}</Text>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowDial}>{item.dial}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={c.accent} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
        </KeyboardAvoidingView>
        </KeyboardProvider>
      </Modal>
    </View>
  );
}

/** Compose the full international number from a country + local digits. */
export const e164 = (country: Country, local: string): string =>
  `${country.dial}${local.replace(/[^\d]/g, '')}`;

const makeStyles = (c: Palette) => StyleSheet.create({
  label: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 13, marginBottom: 8, marginLeft: 2 },

  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.glass,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: c.stroke,
    paddingHorizontal: 12, height: 54,
  },
  fieldFocused: { borderColor: c.accent, backgroundColor: c.accentSoft },
  dialBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 10 },
  flag: { fontSize: 20 },
  dial: { color: c.text, fontFamily: font.bodySemi, fontSize: 15 },
  divider: { width: 1, height: 26, backgroundColor: c.stroke2 },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, paddingLeft: 12, paddingVertical: 0 },

  avoider: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: c.bg2,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderWidth: 1, borderColor: c.stroke,
    maxHeight: '82%',
    minHeight: '50%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.stroke2, marginTop: 10, marginBottom: 2 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  sheetTitle: { color: c.text, fontFamily: font.bodySemi, fontSize: 17 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.glass, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 9,
    marginHorizontal: 14, marginBottom: 10,
    borderWidth: 1, borderColor: c.stroke,
  },
  searchInput: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 15, padding: 0 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 12,
    marginHorizontal: 6, borderRadius: radius.md,
  },
  rowActive: { backgroundColor: c.glass },
  rowFlag: { fontSize: 22 },
  rowName: { flex: 1, color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  rowDial: { color: c.textDim, fontFamily: font.mono, fontSize: 14 },
});
