import { useRef, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, radius } from '@/theme/theme';

/** 6-box one-time-code input with a hidden native field for keyboard/paste. */
export function OtpInput({ value, onChange, length = 6, onComplete }: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  onComplete?: (v: string) => void;
}) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const setVal = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable style={styles.row} onPress={() => ref.current?.focus()}>
      {Array.from({ length }).map((_, i) => {
        const active = focused && i === Math.min(value.length, length - 1) && value.length < length;
        const filled = i < value.length;
        return (
          <View key={i} style={[styles.box, filled && styles.boxFilled, active && styles.boxActive]}>
            <Text style={styles.boxText}>{value[i] ?? ''}</Text>
            {active ? <View style={styles.caret} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={setVal}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 9, justifyContent: 'center' },
  box: {
    width: 48, height: 62, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.stroke, backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.stroke2, backgroundColor: colors.glass2 },
  boxActive: { borderColor: colors.accent, backgroundColor: 'rgba(139,92,246,0.12)' },
  boxText: { color: colors.text, fontFamily: font.display, fontSize: 26 },
  caret: { position: 'absolute', width: 2, height: 26, backgroundColor: colors.accent, borderRadius: 1 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
