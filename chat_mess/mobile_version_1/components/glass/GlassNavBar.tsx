/**
 * GlassNavBar Component
 * A navigation bar with frosted glass effect
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassTint, glassPresets } from '../../design-system/tokens/glass';
import { neutralPalette, primaryPalette } from '../../design-system/tokens/colors';
import { textStyles } from '../../design-system/tokens/typography';

interface GlassNavBarProps {
  title?: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightSecondaryIcon?: React.ReactNode;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onRightSecondaryPress?: () => void;
  variant?: 'light' | 'dark';
  intensity?: number;
  transparent?: boolean;
  scrollY?: SharedValue<number>;
  collapsible?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<ViewStyle>;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const GlassNavBar: React.FC<GlassNavBarProps> = ({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  rightSecondaryIcon,
  onLeftPress,
  onRightPress,
  onRightSecondaryPress,
  variant = 'light',
  intensity = 80,
  transparent = false,
  scrollY,
  collapsible = false,
  style,
  titleStyle,
}) => {
  const insets = useSafeAreaInsets();
  const glassConfig = variant === 'light' ? glassPresets.navLight : glassPresets.navDark;

  const isDark = variant === 'dark';
  const textColor = isDark ? neutralPalette[0] : neutralPalette[900];
  const subtitleColor = isDark ? neutralPalette[300] : neutralPalette[500];
  const iconColor = isDark ? neutralPalette[100] : neutralPalette[700];

  // Animation for collapsible nav
  const animatedStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapsible) return {};

    const opacity = interpolate(
      scrollY.value,
      [0, 50],
      [transparent ? 0 : 1, 1],
      'clamp'
    );

    const blurIntensity = interpolate(
      scrollY.value,
      [0, 50],
      [transparent ? 0 : intensity, intensity],
      'clamp'
    );

    return {
      opacity,
    };
  });

  const renderIconButton = (
    icon: React.ReactNode,
    onPress?: () => void,
    position: 'left' | 'right' = 'left'
  ) => {
    const scale = useSharedValue(1);

    const handlePressIn = () => {
      scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    };

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    if (!icon) return <View style={styles.iconPlaceholder} />;

    return (
      <Animated.View style={buttonAnimatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.iconButton}
        >
          {icon}
        </Pressable>
      </Animated.View>
    );
  };

  const navContent = (
    <View style={[styles.content, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {/* Left section */}
        <View style={styles.leftSection}>
          {renderIconButton(leftIcon, onLeftPress, 'left')}
        </View>

        {/* Center section */}
        <View style={styles.centerSection}>
          {title && (
            <Text
              style={[
                styles.title,
                { color: textColor },
                titleStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              style={[styles.subtitle, { color: subtitleColor }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right section */}
        <View style={styles.rightSection}>
          {renderIconButton(rightSecondaryIcon, onRightSecondaryPress, 'right')}
          {renderIconButton(rightIcon, onRightPress, 'right')}
        </View>
      </View>
    </View>
  );

  if (transparent && !scrollY) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }, style]}>
        {navContent}
      </View>
    );
  }

  return (
    <AnimatedBlurView
      intensity={intensity}
      tint={variant === 'light' ? 'extraLight' : 'dark'}
      style={[
        styles.container,
        {
          backgroundColor: glassConfig.backgroundColor,
          borderBottomWidth: glassConfig.borderWidth,
          borderBottomColor: glassConfig.borderColor,
        },
        animatedStyle,
        style,
      ]}
    >
      {navContent}
    </AnimatedBlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 80,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
  },
});

export default GlassNavBar;
