import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, Palette } from '@/theme/theme';

type Props = TextInputProps & {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  secure?: boolean;
  palette?: Palette;
};

const AView = Animated.createAnimatedComponent(View);

/** Glass input with an animated focus glow ring and optional reveal toggle. */
export function TextField({ label, icon, error, secure, style, palette = colors, ...rest }: Props) {
  const c = palette;
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  const f = useSharedValue(0);

  const aField = useAnimatedStyle(() => ({
    borderColor: error
      ? c.danger
      : interpolateColor(f.value, [0, 1], [c.stroke, c.accent]),
    backgroundColor: interpolateColor(f.value, [0, 1], [c.glass, c.accentSoft]),
  }));

  const setFocus = (v: boolean) => {
    setFocused(v);
    f.value = withTiming(v ? 1 : 0, { duration: 200 });
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: c.textDim }]}>{label}</Text> : null}
      <AView style={[styles.field, aField]}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? c.accent : c.textFaint} style={{ marginRight: 11 }} /> : null}
        <TextInput
          placeholderTextColor={c.textFaint}
          style={[styles.input, { color: c.text }, style as any]}
          secureTextEntry={hidden}
          onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
          {...rest}
        />
        {secure ? (
          <Pressable hitSlop={10} onPress={() => setHidden((h) => !h)}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={c.textFaint} />
          </Pressable>
        ) : null}
      </AView>
      {error ? <Text style={[styles.errText, { color: c.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  label: { fontFamily: font.bodyMed, fontSize: 13, marginLeft: 4, letterSpacing: 0.2 },
  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, height: 56,
  },
  input: { flex: 1, fontFamily: font.body, fontSize: 16, paddingVertical: 0 },
  errText: { fontSize: 12, fontFamily: font.bodyMed, marginLeft: 4 },
});
