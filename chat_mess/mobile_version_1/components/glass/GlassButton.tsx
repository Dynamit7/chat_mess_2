/**
 * GlassButton Component
 * A pressable button with frosted glass effect and haptic feedback
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassTint, glassPresets } from '../../design-system/tokens/glass';
import { primaryPalette, neutralPalette } from '../../design-system/tokens/colors';
import { textStyles } from '../../design-system/tokens/typography';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  intensity?: number;
  tint?: GlassTint;
  hapticFeedback?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const GlassButton: React.FC<GlassButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  intensity = 25,
  tint = 'light',
  hapticFeedback = true,
  style,
  textStyle,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const triggerHaptic = useCallback(async () => {
    if (hapticFeedback && !disabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [hapticFeedback, disabled]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    opacity.value = withSpring(0.9);
    triggerHaptic();
  }, [triggerHaptic]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    opacity.value = withSpring(1);
  }, []);

  const handlePress = useCallback(() => {
    if (!disabled && !loading) {
      scale.value = withSequence(
        withSpring(0.95, { damping: 20 }),
        withSpring(1, { damping: 15 })
      );
      onPress();
    }
  }, [disabled, loading, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Size configurations
  const sizeConfig = {
    sm: { height: 36, paddingHorizontal: 12, fontSize: 13 },
    md: { height: 44, paddingHorizontal: 16, fontSize: 15 },
    lg: { height: 52, paddingHorizontal: 20, fontSize: 17 },
  }[size];

  // Variant configurations
  const variantConfig = {
    primary: {
      backgroundColor: primaryPalette[500],
      textColor: neutralPalette[0],
      borderColor: 'transparent',
      useGlass: false,
    },
    secondary: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      textColor: primaryPalette[600],
      borderColor: 'rgba(255, 255, 255, 0.3)',
      useGlass: true,
    },
    outline: {
      backgroundColor: 'transparent',
      textColor: primaryPalette[500],
      borderColor: primaryPalette[500],
      useGlass: false,
    },
    ghost: {
      backgroundColor: 'transparent',
      textColor: primaryPalette[500],
      borderColor: 'transparent',
      useGlass: false,
    },
    danger: {
      backgroundColor: '#EF4444',
      textColor: neutralPalette[0],
      borderColor: 'transparent',
      useGlass: false,
    },
  }[variant];

  const containerStyle: ViewStyle = {
    height: sizeConfig.height,
    paddingHorizontal: sizeConfig.paddingHorizontal,
    borderRadius: sizeConfig.height / 2,
    backgroundColor: variantConfig.backgroundColor,
    borderWidth: variantConfig.borderColor !== 'transparent' ? 1.5 : 0,
    borderColor: variantConfig.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? '100%' : undefined,
    overflow: 'hidden',
  };

  const buttonTextStyle: TextStyle = {
    color: variantConfig.textColor,
    fontSize: sizeConfig.fontSize,
    fontWeight: '600',
    marginLeft: icon && iconPosition === 'left' ? 8 : 0,
    marginRight: icon && iconPosition === 'right' ? 8 : 0,
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variantConfig.textColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={[buttonTextStyle, textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </>
  );

  if (variantConfig.useGlass) {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[animatedStyle, style]}
      >
        <BlurView intensity={intensity} tint={tint} style={containerStyle}>
          <View style={styles.contentContainer}>{content}</View>
        </BlurView>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[containerStyle, animatedStyle, style]}
    >
      {content}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});

export default GlassButton;
