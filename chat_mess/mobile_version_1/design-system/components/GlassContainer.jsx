/**
 * GlassContainer - Glassmorphism container component
 * Creates frosted glass effect with blur and transparency
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../../ThemeContext';
import { glass, gradients } from '../tokens/colors';
import { borderRadius } from '../tokens/spacing';
import { glassShadows } from '../tokens/shadows';
import { timingConfigs } from '../tokens/animations';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const GlassContainer = ({
  children,
  style,
  intensity = 'medium', // 'light', 'medium', 'strong'
  variant = 'default', // 'default', 'card', 'modal', 'bubble'
  gradient = false, // Enable gradient overlay
  gradientColors = null,
  borderWidth = 1,
  animated = false,
  animatedValue = null, // Shared value for animations
  onPress,
  ...props
}) => {
  const { isDarkMode } = useTheme();
  const glassConfig = isDarkMode ? glass.dark : glass.light;
  const shadowConfig = isDarkMode ? glassShadows.dark : glassShadows.light;

  // Intensity mapping
  const intensityMap = {
    light: { blur: 10, opacity: 0.15 },
    medium: { blur: 20, opacity: 0.25 },
    strong: { blur: 40, opacity: 0.4 },
  };

  const currentIntensity = intensityMap[intensity] || intensityMap.medium;

  // Variant styles
  const variantStyles = {
    default: {
      borderRadius: borderRadius.lg,
      ...shadowConfig.card,
    },
    card: {
      borderRadius: borderRadius.xl,
      ...shadowConfig.card,
    },
    modal: {
      borderRadius: borderRadius['2xl'],
      ...shadowConfig.modal,
    },
    bubble: {
      borderRadius: borderRadius.xl,
      ...shadowConfig.bubble,
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.default;

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => {
    if (!animated || !animatedValue) return {};

    return {
      opacity: interpolate(animatedValue.value, [0, 1], [0, 1]),
      transform: [
        {
          scale: interpolate(animatedValue.value, [0, 1], [0.95, 1]),
        },
      ],
    };
  }, [animated, animatedValue]);

  // Web fallback (BlurView doesn't work well on web)
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: glassConfig.background,
            borderRadius: currentVariant.borderRadius,
            borderWidth,
            borderColor: glassConfig.border,
            backdropFilter: `blur(${currentIntensity.blur}px)`,
            WebkitBackdropFilter: `blur(${currentIntensity.blur}px)`,
          },
          currentVariant,
          style,
          animated && animatedContainerStyle,
        ]}
        {...props}
      >
        {gradient && (
          <LinearGradient
            colors={gradientColors || gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFill,
              { opacity: 0.1, borderRadius: currentVariant.borderRadius },
            ]}
          />
        )}
        {children}
      </Animated.View>
    );
  }

  // Native implementation with BlurView
  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderRadius: currentVariant.borderRadius,
          overflow: 'hidden',
        },
        currentVariant,
        style,
        animated && animatedContainerStyle,
      ]}
      {...props}
    >
      <BlurView
        intensity={currentIntensity.blur}
        tint={isDarkMode ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Glass overlay */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: glassConfig.background,
            opacity: currentIntensity.opacity,
          },
        ]}
      />

      {/* Border overlay */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: currentVariant.borderRadius,
            borderWidth,
            borderColor: glassConfig.border,
          },
        ]}
        pointerEvents="none"
      />

      {/* Gradient overlay */}
      {gradient && (
        <LinearGradient
          colors={gradientColors || gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { opacity: 0.1 },
          ]}
        />
      )}

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
};

// Preset variants
export const GlassCard = (props) => (
  <GlassContainer variant="card" intensity="medium" {...props} />
);

export const GlassModal = (props) => (
  <GlassContainer variant="modal" intensity="strong" {...props} />
);

export const GlassBubble = (props) => (
  <GlassContainer variant="bubble" intensity="light" {...props} />
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});

export default GlassContainer;
