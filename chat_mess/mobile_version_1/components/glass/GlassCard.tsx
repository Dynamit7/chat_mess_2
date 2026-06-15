/**
 * GlassCard Component
 * A reusable frosted glass card container with blur effects
 */

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import { GlassTint, glassPresets, glassRadius } from '../../design-system/tokens/glass';
import { elevations } from '../../design-system/tokens/shadows';

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: GlassTint;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
  elevation?: keyof typeof elevations;
  variant?: 'light' | 'dark' | 'oled';
  preset?: keyof typeof glassPresets;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity,
  tint,
  backgroundColor,
  borderColor,
  borderWidth,
  borderRadius,
  padding = 16,
  margin,
  style,
  animated = false,
  elevation = 'md',
  variant = 'light',
  preset,
}) => {
  const scale = useSharedValue(1);

  // Use preset if provided, otherwise use individual props
  const presetKey = preset || (variant === 'light' ? 'cardLight' : variant === 'dark' ? 'cardDark' : 'cardDark');
  const glassConfig = glassPresets[presetKey];

  const finalIntensity = intensity ?? glassConfig.blur;
  const finalTint = tint ?? glassConfig.tint;
  const finalBackgroundColor = backgroundColor ?? glassConfig.backgroundColor;
  const finalBorderColor = borderColor ?? glassConfig.borderColor;
  const finalBorderWidth = borderWidth ?? glassConfig.borderWidth;
  const finalBorderRadius = borderRadius ?? glassConfig.borderRadius;

  const shadowStyle = elevations[elevation];

  const animatedStyle = useAnimatedStyle(() => {
    if (!animated) return {};
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const containerStyle: ViewStyle = {
    borderRadius: finalBorderRadius,
    overflow: 'hidden',
    margin,
    ...shadowStyle,
  };

  const blurStyle: ViewStyle = {
    borderRadius: finalBorderRadius,
    overflow: 'hidden',
  };

  const overlayStyle: ViewStyle = {
    backgroundColor: finalBackgroundColor,
    borderWidth: finalBorderWidth,
    borderColor: finalBorderColor,
    borderRadius: finalBorderRadius,
    padding,
  };

  if (animated) {
    return (
      <Animated.View style={[containerStyle, animatedStyle, style]}>
        <AnimatedBlurView intensity={finalIntensity} tint={finalTint} style={blurStyle}>
          <View style={overlayStyle}>{children}</View>
        </AnimatedBlurView>
      </Animated.View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <BlurView intensity={finalIntensity} tint={finalTint} style={blurStyle}>
        <View style={overlayStyle}>{children}</View>
      </BlurView>
    </View>
  );
};

export default GlassCard;
