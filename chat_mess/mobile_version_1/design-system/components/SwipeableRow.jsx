/**
 * SwipeableRow - Swipe gesture row for lists
 * Reveals action buttons on swipe
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../ThemeContext';
import { spring, gesture } from '../tokens/animations';
import { spacing, borderRadius } from '../tokens/spacing';
import { palette, lightTheme, darkTheme } from '../tokens/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default action width
const ACTION_WIDTH = 80;

export const SwipeableRow = ({
  children,
  leftActions = [], // [{ icon, color, backgroundColor, onPress, label }]
  rightActions = [], // [{ icon, color, backgroundColor, onPress, label }]
  onSwipeLeft,
  onSwipeRight,
  threshold = 0.4, // Percentage of width to trigger action
  friction = 2, // Resistance when over-swiping
  overshootLeft = false,
  overshootRight = false,
  simultaneousHandlers,
  style,
  ...props
}) => {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Calculate action widths
  const leftActionsWidth = leftActions.length * ACTION_WIDTH;
  const rightActionsWidth = rightActions.length * ACTION_WIDTH;

  // Shared values
  const translateX = useSharedValue(0);
  const context = useSharedValue({ x: 0 });
  const isOpen = useSharedValue(false);

  // Reset to closed state
  const close = useCallback(() => {
    'worklet';
    translateX.value = withSpring(0, spring.snappy);
    isOpen.value = false;
  }, []);

  // Expose close method
  const handleActionPress = useCallback((action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    close();
    action.onPress?.();
  }, [close]);

  // Pan gesture handler
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onStart(() => {
      context.value = { x: translateX.value };
    })
    .onUpdate((event) => {
      let newX = context.value.x + event.translationX;

      // Apply limits and friction
      if (newX > 0) {
        // Swiping right
        if (leftActions.length === 0) {
          newX = overshootRight ? newX / friction : 0;
        } else {
          if (newX > leftActionsWidth) {
            newX = leftActionsWidth + (newX - leftActionsWidth) / friction;
          }
        }
      } else {
        // Swiping left
        if (rightActions.length === 0) {
          newX = overshootLeft ? newX / friction : 0;
        } else {
          if (newX < -rightActionsWidth) {
            newX = -rightActionsWidth + (newX + rightActionsWidth) / friction;
          }
        }
      }

      translateX.value = newX;
    })
    .onEnd((event) => {
      const velocity = event.velocityX;

      // Check for fast swipe
      if (Math.abs(velocity) > gesture.swipe.velocityThreshold) {
        if (velocity > 0 && leftActions.length > 0) {
          // Fast swipe right - open left actions
          translateX.value = withSpring(leftActionsWidth, spring.snappy);
          isOpen.value = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (onSwipeRight) {
            runOnJS(onSwipeRight)();
          }
        } else if (velocity < 0 && rightActions.length > 0) {
          // Fast swipe left - open right actions
          translateX.value = withSpring(-rightActionsWidth, spring.snappy);
          isOpen.value = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (onSwipeLeft) {
            runOnJS(onSwipeLeft)();
          }
        } else {
          close();
        }
        return;
      }

      // Check position threshold
      const currentX = translateX.value;

      if (currentX > leftActionsWidth * threshold && leftActions.length > 0) {
        // Open left actions
        translateX.value = withSpring(leftActionsWidth, spring.snappy);
        isOpen.value = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (currentX < -rightActionsWidth * threshold && rightActions.length > 0) {
        // Open right actions
        translateX.value = withSpring(-rightActionsWidth, spring.snappy);
        isOpen.value = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        // Close
        close();
      }
    });

  // Animated styles
  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Left actions animated style
  const leftActionsAnimatedStyle = useAnimatedStyle(() => {
    const width = interpolate(
      translateX.value,
      [0, leftActionsWidth],
      [0, leftActionsWidth],
      Extrapolate.CLAMP
    );

    return {
      width: Math.max(0, translateX.value),
    };
  });

  // Right actions animated style
  const rightActionsAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: Math.max(0, -translateX.value),
    };
  });

  // Render action button
  const renderAction = (action, index, side) => {
    const actionAnimatedStyle = useAnimatedStyle(() => {
      const progress = side === 'left'
        ? interpolate(translateX.value, [0, leftActionsWidth], [0, 1], Extrapolate.CLAMP)
        : interpolate(translateX.value, [-rightActionsWidth, 0], [1, 0], Extrapolate.CLAMP);

      return {
        opacity: progress,
        transform: [{ scale: interpolate(progress, [0, 1], [0.8, 1]) }],
      };
    });

    return (
      <Animated.View
        key={index}
        style={[
          styles.action,
          {
            backgroundColor: action.backgroundColor || palette.primary[500],
            width: ACTION_WIDTH,
          },
          actionAnimatedStyle,
        ]}
      >
        <GestureDetector
          gesture={Gesture.Tap().onEnd(() => {
            runOnJS(handleActionPress)(action);
          })}
        >
          <View style={styles.actionContent}>
            <MaterialCommunityIcons
              name={action.icon}
              size={24}
              color={action.color || '#FFFFFF'}
            />
            {action.label && (
              <Text style={[styles.actionLabel, { color: action.color || '#FFFFFF' }]}>
                {action.label}
              </Text>
            )}
          </View>
        </GestureDetector>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, style]} {...props}>
      {/* Left actions */}
      {leftActions.length > 0 && (
        <Animated.View style={[styles.actionsContainer, styles.leftActions, leftActionsAnimatedStyle]}>
          {leftActions.map((action, index) => renderAction(action, index, 'left'))}
        </Animated.View>
      )}

      {/* Right actions */}
      {rightActions.length > 0 && (
        <Animated.View style={[styles.actionsContainer, styles.rightActions, rightActionsAnimatedStyle]}>
          {rightActions.map((action, index) => renderAction(action, index, 'right'))}
        </Animated.View>
      )}

      {/* Main content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.row, rowAnimatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

// Preset swipeable chat item
export const SwipeableChatItem = ({
  children,
  onArchive,
  onDelete,
  onPin,
  onMute,
  ...props
}) => {
  const rightActions = [];
  const leftActions = [];

  if (onPin) {
    leftActions.push({
      icon: 'pin',
      backgroundColor: palette.primary[500],
      label: 'Pin',
      onPress: onPin,
    });
  }

  if (onMute) {
    rightActions.push({
      icon: 'bell-off',
      backgroundColor: palette.warning.main,
      label: 'Mute',
      onPress: onMute,
    });
  }

  if (onArchive) {
    rightActions.push({
      icon: 'archive',
      backgroundColor: palette.info.main,
      label: 'Archive',
      onPress: onArchive,
    });
  }

  if (onDelete) {
    rightActions.push({
      icon: 'delete',
      backgroundColor: palette.error.main,
      label: 'Delete',
      onPress: onDelete,
    });
  }

  return (
    <SwipeableRow
      leftActions={leftActions}
      rightActions={rightActions}
      {...props}
    >
      {children}
    </SwipeableRow>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  row: {
    backgroundColor: 'transparent',
  },
  actionsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  leftActions: {
    left: 0,
    justifyContent: 'flex-start',
  },
  rightActions: {
    right: 0,
    justifyContent: 'flex-end',
  },
  action: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[2],
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: spacing[1],
  },
});

export default SwipeableRow;
