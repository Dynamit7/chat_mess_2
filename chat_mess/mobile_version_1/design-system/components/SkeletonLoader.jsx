/**
 * SkeletonLoader - Loading placeholder component
 * Animated shimmer effect for content loading states
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../ThemeContext';
import { borderRadius as br, spacing } from '../tokens/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SkeletonLoader = ({
  width = '100%',
  height = 20,
  borderRadius = br.sm,
  style,
  variant = 'default', // 'default', 'circle', 'text', 'avatar', 'card'
  shimmer = true,
  lines = 1, // For text variant
  lastLineWidth = '60%', // Width of last line for text
}) => {
  const { isDarkMode } = useTheme();
  const shimmerValue = useSharedValue(0);

  // Colors based on theme
  const baseColor = isDarkMode ? '#2A2A2A' : '#E5E5E5';
  const highlightColor = isDarkMode ? '#3A3A3A' : '#F5F5F5';

  useEffect(() => {
    if (shimmer) {
      shimmerValue.value = withRepeat(
        withTiming(1, {
          duration: 1200,
          easing: Easing.linear,
        }),
        -1, // Infinite
        false // Don't reverse
      );
    }
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!shimmer) return {};

    const translateX = interpolate(
      shimmerValue.value,
      [0, 1],
      [-SCREEN_WIDTH, SCREEN_WIDTH]
    );

    return {
      transform: [{ translateX }],
    };
  });

  // Variant configurations
  const variantConfig = {
    default: { width, height, borderRadius },
    circle: {
      width: height,
      height,
      borderRadius: height / 2,
    },
    text: { width, height: 14, borderRadius: br.xs },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    card: {
      width: '100%',
      height: 120,
      borderRadius: br.lg,
    },
  };

  const config = variantConfig[variant] || variantConfig.default;

  // Render text lines
  if (variant === 'text' && lines > 1) {
    return (
      <View style={[styles.textContainer, style]}>
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonBase
            key={index}
            width={index === lines - 1 ? lastLineWidth : '100%'}
            height={config.height}
            borderRadius={config.borderRadius}
            baseColor={baseColor}
            highlightColor={highlightColor}
            shimmer={shimmer}
            shimmerValue={shimmerValue}
            animatedStyle={animatedStyle}
            style={index < lines - 1 && styles.textLine}
          />
        ))}
      </View>
    );
  }

  return (
    <SkeletonBase
      width={config.width}
      height={config.height}
      borderRadius={config.borderRadius}
      baseColor={baseColor}
      highlightColor={highlightColor}
      shimmer={shimmer}
      shimmerValue={shimmerValue}
      animatedStyle={animatedStyle}
      style={style}
    />
  );
};

// Base skeleton element
const SkeletonBase = ({
  width,
  height,
  borderRadius,
  baseColor,
  highlightColor,
  shimmer,
  animatedStyle,
  style,
}) => (
  <View
    style={[
      styles.skeleton,
      {
        width,
        height,
        borderRadius,
        backgroundColor: baseColor,
      },
      style,
    ]}
  >
    {shimmer && (
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            highlightColor,
            'transparent',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFill, { width: SCREEN_WIDTH }]}
        />
      </Animated.View>
    )}
  </View>
);

// Pre-built skeleton compositions
export const SkeletonAvatar = ({ size = 48, style }) => (
  <SkeletonLoader
    variant="circle"
    height={size}
    style={style}
  />
);

export const SkeletonText = ({ lines = 3, style }) => (
  <SkeletonLoader
    variant="text"
    lines={lines}
    style={style}
  />
);

export const SkeletonCard = ({ style }) => (
  <SkeletonLoader
    variant="card"
    style={style}
  />
);

// Chat list item skeleton
export const SkeletonChatItem = ({ style }) => {
  const { isDarkMode } = useTheme();

  return (
    <View style={[styles.chatItem, style]}>
      <SkeletonAvatar size={52} />
      <View style={styles.chatItemContent}>
        <SkeletonLoader width="60%" height={16} borderRadius={br.xs} />
        <SkeletonLoader
          width="80%"
          height={14}
          borderRadius={br.xs}
          style={{ marginTop: spacing[2] }}
        />
      </View>
      <View style={styles.chatItemRight}>
        <SkeletonLoader width={40} height={12} borderRadius={br.xs} />
      </View>
    </View>
  );
};

// Message skeleton
export const SkeletonMessage = ({ isSent = false, style }) => (
  <View
    style={[
      styles.message,
      isSent ? styles.messageSent : styles.messageReceived,
      style,
    ]}
  >
    <SkeletonLoader
      width={200}
      height={40}
      borderRadius={br.lg}
    />
  </View>
);

// Story item skeleton
export const SkeletonStoryItem = ({ style }) => (
  <View style={[styles.storyItem, style]}>
    <SkeletonAvatar size={64} />
    <SkeletonLoader
      width={60}
      height={12}
      borderRadius={br.xs}
      style={{ marginTop: spacing[2] }}
    />
  </View>
);

// Full chat list skeleton
export const SkeletonChatList = ({ count = 8 }) => (
  <View>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonChatItem key={index} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  textContainer: {
    width: '100%',
  },
  textLine: {
    marginBottom: spacing[2],
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  chatItemContent: {
    flex: 1,
    marginLeft: spacing[3],
  },
  chatItemRight: {
    alignItems: 'flex-end',
  },
  message: {
    marginVertical: spacing[1],
    marginHorizontal: spacing[4],
  },
  messageSent: {
    alignSelf: 'flex-end',
  },
  messageReceived: {
    alignSelf: 'flex-start',
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: spacing[2],
  },
});

export default SkeletonLoader;
