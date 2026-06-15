import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius } from '@/theme/theme';

type Props = TextInputProps & {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  secure?: boolean;
};

const AView = Animated.createAnimatedComponent(View);

/** Glass input with an animated focus glow ring and optional reveal toggle. */
export function TextField({ label, icon, error, secure, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  const f = useSharedValue(0);

  const aField = useAnimatedStyle(() => ({
    borderColor: error
      ? colors.danger
      : interpolateColor(f.value, [0, 1], [colors.stroke, colors.accent]),
    backgroundColor: interpolateColor(f.value, [0, 1], ['rgba(255,255,255,0.04)', 'rgba(139,92,246,0.10)']),
  }));

  const setFocus = (v: boolean) => {
    setFocused(v);
    f.value = withTiming(v ? 1 : 0, { duration: 200 });
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <AView style={[styles.field, aField]}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? colors.accent : colors.textFaint} style={{ marginRight: 11 }} /> : null}
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[styles.input, style as any]}
          secureTextEntry={hidden}
          onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
          {...rest}
        />
        {secure ? (
          <Pressable hitSlop={10} onPress={() => setHidden((h) => !h)}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </AView>
      {error ? <Text style={styles.errText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  label: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 13, marginLeft: 4, letterSpacing: 0.2 },
  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, height: 56,
  },
  input: { flex: 1, color: colors.text, fontFamily: font.body, fontSize: 16, paddingVertical: 0 },
  errText: { color: colors.danger, fontSize: 12, fontFamily: font.bodyMed, marginLeft: 4 },
});
