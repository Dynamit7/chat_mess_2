/**
 * FAB - Floating Action Button
 * Material Design style with animation options
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../ThemeContext';
import { spring, timingConfigs } from '../tokens/animations';
import { borderRadius, spacing } from '../tokens/spacing';
import { palette, gradients } from '../tokens/colors';
import { coloredShadows } from '../tokens/shadows';

export const FAB = ({
  icon = 'plus',
  iconColor = '#FFFFFF',
  size = 'md', // 'sm', 'md', 'lg'
  variant = 'primary', // 'primary', 'secondary', 'gradient'
  position = 'bottom-right', // 'bottom-right', 'bottom-left', 'bottom-center'
  onPress,
  label = null,
  extended = false,
  disabled = false,
  style,
  ...props
}) => {
  const { isDarkMode } = useTheme();

  // Animation values
  const pressed = useSharedValue(0);
  const scale = useSharedValue(1);

  // Size configurations
  const sizeConfig = {
    sm: { size: 40, iconSize: 20 },
    md: { size: 56, iconSize: 24 },
    lg: { size: 72, iconSize: 32 },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  // Variant styles
  const variantConfig = {
    primary: {
      backgroundColor: palette.primary[500],
      shadow: coloredShadows.primary,
    },
    secondary: {
      backgroundColor: palette.secondary[500],
      shadow: coloredShadows.secondary,
    },
    gradient: {
      gradient: gradients.primary,
      shadow: coloredShadows.primary,
    },
  };

  const currentVariant = variantConfig[variant] || variantConfig.primary;

  // Position styles
  const positionStyles = {
    'bottom-right': { bottom: 24, right: 24 },
    'bottom-left': { bottom: 24, left: 24 },
    'bottom-center': { bottom: 24, alignSelf: 'center', left: 0, right: 0 },
  };

  // Gesture handler
  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      pressed.value = withTiming(1, { duration: 100 });
      scale.value = withSpring(0.92, spring.button);
    })
    .onFinalize((_, success) => {
      pressed.value = withTiming(0, { duration: 150 });
      scale.value = withSpring(1, spring.button);

      if (success && onPress) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }
    });

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  const Content = () => (
    <View style={styles.content}>
      <MaterialCommunityIcons
        name={icon}
        size={currentSize.iconSize}
        color={iconColor}
      />
      {extended && label && (
        <Text style={[styles.label, { color: iconColor }]}>{label}</Text>
      )}
    </View>
  );

  if (variant === 'gradient') {
    return (
      <GestureDetector gesture={tapGesture}>
        <Animated.View
          style={[
            styles.fab,
            {
              width: extended ? 'auto' : currentSize.size,
              height: currentSize.size,
              borderRadius: extended ? currentSize.size / 2 : currentSize.size / 2,
              paddingHorizontal: extended ? spacing[6] : 0,
            },
            currentVariant.shadow,
            positionStyles[position],
            animatedStyle,
            style,
          ]}
          {...props}
        >
          <LinearGradient
            colors={currentVariant.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: extended ? currentSize.size / 2 : currentSize.size / 2 },
            ]}
          />
          <Content />
        </Animated.View>
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        style={[
          styles.fab,
          {
            width: extended ? 'auto' : currentSize.size,
            height: currentSize.size,
            borderRadius: extended ? currentSize.size / 2 : currentSize.size / 2,
            paddingHorizontal: extended ? spacing[6] : 0,
            backgroundColor: currentVariant.backgroundColor,
          },
          currentVariant.shadow,
          positionStyles[position],
          animatedStyle,
          style,
        ]}
        {...props}
      >
        <Content />
      </Animated.View>
    </GestureDetector>
  );
};

// Expandable FAB with speed dial
export const ExpandableFAB = ({
  icon = 'plus',
  expandedIcon = 'close',
  actions = [], // [{ icon, label, onPress, color }]
  position = 'bottom-right',
  ...props
}) => {
  const [expanded, setExpanded] = useState(false);
  const expandValue = useSharedValue(0);

  const toggleExpand = useCallback(() => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    expandValue.value = withSpring(newExpanded ? 1 : 0, spring.bouncy);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [expanded]);

  // Main button rotation
  const mainButtonStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(expandValue.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  // Position styles for expand direction
  const positionConfig = {
    'bottom-right': { bottom: 24, right: 24 },
    'bottom-left': { bottom: 24, left: 24 },
  };

  return (
    <View style={[styles.expandableContainer, positionConfig[position]]}>
      {/* Action buttons */}
      {actions.map((action, index) => {
        const animatedActionStyle = useAnimatedStyle(() => {
          const translateY = interpolate(
            expandValue.value,
            [0, 1],
            [0, -(70 * (index + 1))]
          );
          const opacity = interpolate(expandValue.value, [0, 0.5, 1], [0, 0, 1]);
          const scale = interpolate(expandValue.value, [0, 1], [0.5, 1]);

          return {
            transform: [{ translateY }, { scale }],
            opacity,
          };
        });

        return (
          <Animated.View
            key={index}
            style={[styles.actionButton, animatedActionStyle]}
          >
            <View style={styles.actionRow}>
              {action.label && (
                <View style={styles.actionLabel}>
                  <Text style={styles.actionLabelText}>{action.label}</Text>
                </View>
              )}
              <FAB
                icon={action.icon}
                size="sm"
                variant="primary"
                onPress={() => {
                  action.onPress?.();
                  toggleExpand();
                }}
                style={{
                  position: 'relative',
                  backgroundColor: action.color || palette.primary[500],
                }}
              />
            </View>
          </Animated.View>
        );
      })}

      {/* Main FAB */}
      <Animated.View style={mainButtonStyle}>
        <FAB
          icon={expanded ? expandedIcon : icon}
          onPress={toggleExpand}
          style={{ position: 'relative' }}
          {...props}
        />
      </Animated.View>

      {/* Backdrop */}
      {expanded && (
        <GestureDetector
          gesture={Gesture.Tap().onEnd(() => {
            runOnJS(toggleExpand)();
          })}
        >
          <View style={styles.backdrop} />
        </GestureDetector>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing[2],
  },
  expandableContainer: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1000,
  },
  actionButton: {
    position: 'absolute',
    bottom: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionLabel: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.sm,
    marginRight: spacing[3],
  },
  actionLabelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  backdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -100,
    zIndex: -1,
  },
});

export default FAB;
