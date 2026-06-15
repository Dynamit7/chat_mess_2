/**
 * NeoButton - Neomorphism style button
 * Soft shadows, press feedback, multiple variants
 */

import React, { useCallback } from 'react';
import { StyleSheet, Text, ActivityIndicator, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../ThemeContext';
import { spring, timingConfigs } from '../tokens/animations';
import { borderRadius, spacing, semantic } from '../tokens/spacing';
import { textStyles } from '../tokens/typography';
import { lightTheme, darkTheme, gradients, palette } from '../tokens/colors';
import { shadows, neoShadows, coloredShadows } from '../tokens/shadows';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export const NeoButton = ({
  children,
  title,
  onPress,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost', 'gradient'
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  fullWidth = false,
  haptic = true,
  style,
  textStyle,
  ...props
}) => {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const neoShadow = isDarkMode ? neoShadows.dark : neoShadows.light;

  // Animation values
  const pressed = useSharedValue(0);
  const scale = useSharedValue(1);

  // Size configurations
  const sizeConfig = {
    sm: {
      height: 36,
      paddingHorizontal: spacing[4],
      fontSize: 14,
      iconSize: 16,
    },
    md: {
      height: 44,
      paddingHorizontal: spacing[6],
      fontSize: 16,
      iconSize: 20,
    },
    lg: {
      height: 52,
      paddingHorizontal: spacing[8],
      fontSize: 18,
      iconSize: 24,
    },
    xl: {
      height: 60,
      paddingHorizontal: spacing[10],
      fontSize: 20,
      iconSize: 28,
    },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  // Variant configurations
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: palette.primary[500],
          textColor: '#FFFFFF',
          shadow: coloredShadows.primary,
          pressedBg: palette.primary[600],
        };
      case 'secondary':
        return {
          backgroundColor: palette.secondary[500],
          textColor: '#FFFFFF',
          shadow: coloredShadows.secondary,
          pressedBg: palette.secondary[600],
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          textColor: palette.primary[500],
          borderColor: palette.primary[500],
          borderWidth: 2,
          shadow: shadows.none,
          pressedBg: isDarkMode ? 'rgba(142, 68, 173, 0.1)' : 'rgba(142, 68, 173, 0.05)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          textColor: theme.text.primary,
          shadow: shadows.none,
          pressedBg: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        };
      case 'gradient':
        return {
          gradient: gradients.primary,
          textColor: '#FFFFFF',
          shadow: coloredShadows.primary,
        };
      case 'neo':
        return {
          backgroundColor: theme.background.secondary,
          textColor: theme.text.primary,
          shadow: neoShadow.raised,
          pressedShadow: neoShadow.pressed,
        };
      default:
        return {
          backgroundColor: palette.primary[500],
          textColor: '#FFFFFF',
          shadow: shadows.md,
        };
    }
  };

  const variantStyles = getVariantStyles();

  // Gesture handler
  const tapGesture = Gesture.Tap()
    .enabled(!disabled && !loading)
    .onBegin(() => {
      pressed.value = withTiming(1, { duration: 100 });
      scale.value = withSpring(0.97, spring.button);
    })
    .onFinalize((_, success) => {
      pressed.value = withTiming(0, { duration: 150 });
      scale.value = withSpring(1, spring.button);

      if (success && onPress) {
        if (haptic) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }
    });

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(pressed.value, [0, 1], [1, 0.5]);

    return {
      transform: [{ scale: scale.value }],
      opacity: disabled ? 0.5 : 1,
      shadowOpacity,
    };
  });

  const animatedBgStyle = useAnimatedStyle(() => {
    if (variant === 'gradient') return {};

    const bgColor = interpolateColor(
      pressed.value,
      [0, 1],
      [
        variantStyles.backgroundColor || 'transparent',
        variantStyles.pressedBg || variantStyles.backgroundColor || 'transparent',
      ]
    );

    return {
      backgroundColor: bgColor,
    };
  });

  // Content
  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={variantStyles.textColor}
          size={currentSize.iconSize}
        />
      );
    }

    const textElement = title ? (
      <Text
        style={[
          styles.text,
          {
            color: variantStyles.textColor,
            fontSize: currentSize.fontSize,
            marginLeft: icon && iconPosition === 'left' ? spacing[2] : 0,
            marginRight: icon && iconPosition === 'right' ? spacing[2] : 0,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    ) : null;

    const iconElement = icon ? (
      <View style={{ width: currentSize.iconSize, height: currentSize.iconSize }}>
        {React.cloneElement(icon, {
          size: currentSize.iconSize,
          color: variantStyles.textColor,
        })}
      </View>
    ) : null;

    return (
      <View style={styles.contentContainer}>
        {iconPosition === 'left' && iconElement}
        {textElement || children}
        {iconPosition === 'right' && iconElement}
      </View>
    );
  };

  // Render gradient variant
  if (variant === 'gradient') {
    return (
      <GestureDetector gesture={tapGesture}>
        <Animated.View
          style={[
            styles.container,
            {
              height: currentSize.height,
              paddingHorizontal: currentSize.paddingHorizontal,
              borderRadius: borderRadius.lg,
              width: fullWidth ? '100%' : 'auto',
            },
            variantStyles.shadow,
            animatedContainerStyle,
            style,
          ]}
          {...props}
        >
          <LinearGradient
            colors={variantStyles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
          />
          {renderContent()}
        </Animated.View>
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        style={[
          styles.container,
          {
            height: currentSize.height,
            paddingHorizontal: currentSize.paddingHorizontal,
            borderRadius: borderRadius.lg,
            width: fullWidth ? '100%' : 'auto',
            borderWidth: variantStyles.borderWidth || 0,
            borderColor: variantStyles.borderColor || 'transparent',
          },
          variantStyles.shadow,
          animatedContainerStyle,
          animatedBgStyle,
          style,
        ]}
        {...props}
      >
        {renderContent()}
      </Animated.View>
    </GestureDetector>
  );
};

// Icon button variant
export const IconButton = ({
  icon,
  onPress,
  size = 'md',
  variant = 'ghost',
  ...props
}) => {
  const sizeMap = {
    sm: 36,
    md: 44,
    lg: 52,
    xl: 60,
  };

  return (
    <NeoButton
      onPress={onPress}
      variant={variant}
      size={size}
      icon={icon}
      style={{
        width: sizeMap[size],
        paddingHorizontal: 0,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...textStyles.button,
  },
});

export default NeoButton;
