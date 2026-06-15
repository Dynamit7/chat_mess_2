import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, shadow, gradients } from '@/theme/theme';

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'glass';
  style?: ViewStyle;
  icon?: React.ReactNode;
};

/**
 * Primary CTA = violet→indigo gradient with white label and a soft glow.
 * Press feedback is a quiet opacity dip.
 */
export function Button({ label, onPress, loading, disabled, variant = 'primary', style, icon }: Props) {
  const handle = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const isPrimary = variant === 'primary';
  const labelColor = isPrimary ? colors.ink : colors.text;

  return (
    <Pressable
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : variant === 'glass' ? styles.glass : styles.ghost,
        isPrimary && shadow.glow,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <>
            {icon}
            <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: font.bodySemi, fontSize: 16.5, letterSpacing: 0.2 },
  primary: { backgroundColor: colors.brand3 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.stroke2 },
  glass: { backgroundColor: colors.glass2, borderWidth: 1, borderColor: colors.stroke },
});
