/**
 * BottomSheet - Gesture-driven bottom sheet modal
 * Smooth dragging, snap points, backdrop
 */

import React, { useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../ThemeContext';
import { GlassContainer } from './GlassContainer';
import { spring, timingConfigs } from '../tokens/animations';
import { borderRadius, spacing, semantic } from '../tokens/spacing';
import { lightTheme, darkTheme } from '../tokens/colors';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const BottomSheet = forwardRef(({
  children,
  snapPoints = ['25%', '50%', '90%'], // Array of snap points
  initialIndex = -1, // -1 means closed
  onClose,
  onIndexChange,
  enablePanDownToClose = true,
  enableBackdropDismiss = true,
  backdropOpacity = 0.5,
  handleComponent = null,
  style,
  contentStyle,
  useGlass = true,
}, ref) => {
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Convert snap points to pixel values
  const snapPointsPixels = snapPoints.map(point => {
    if (typeof point === 'string' && point.endsWith('%')) {
      return SCREEN_HEIGHT * (parseFloat(point) / 100);
    }
    return point;
  });

  // Shared values
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const currentIndex = useSharedValue(initialIndex);
  const context = useSharedValue({ y: 0 });
  const active = useSharedValue(false);

  // Calculate positions
  const maxTranslateY = SCREEN_HEIGHT;
  const getTranslateYForIndex = (index) => {
    if (index < 0 || index >= snapPointsPixels.length) {
      return SCREEN_HEIGHT;
    }
    return SCREEN_HEIGHT - snapPointsPixels[index];
  };

  // Imperative handle methods
  useImperativeHandle(ref, () => ({
    open: (index = 0) => {
      'worklet';
      currentIndex.value = index;
      translateY.value = withSpring(
        getTranslateYForIndex(index),
        spring.modal
      );
      active.value = true;
    },
    close: () => {
      'worklet';
      currentIndex.value = -1;
      translateY.value = withSpring(SCREEN_HEIGHT, spring.modal);
      active.value = false;
      if (onClose) {
        runOnJS(onClose)();
      }
    },
    snapToIndex: (index) => {
      'worklet';
      if (index >= 0 && index < snapPointsPixels.length) {
        currentIndex.value = index;
        translateY.value = withSpring(
          getTranslateYForIndex(index),
          spring.modal
        );
      }
    },
    getCurrentIndex: () => currentIndex.value,
  }));

  // Open on mount if initialIndex >= 0
  useEffect(() => {
    if (initialIndex >= 0) {
      translateY.value = withSpring(
        getTranslateYForIndex(initialIndex),
        spring.modal
      );
      active.value = true;
    }
  }, []);

  // Handle back button on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (active.value) {
        ref?.current?.close();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, []);

  // Notify index change
  const notifyIndexChange = useCallback((index) => {
    if (onIndexChange) {
      onIndexChange(index);
    }
  }, [onIndexChange]);

  // Pan gesture handler
  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const newY = context.value.y + event.translationY;
      const minY = getTranslateYForIndex(snapPointsPixels.length - 1);

      if (enablePanDownToClose) {
        translateY.value = Math.max(newY, minY);
      } else {
        translateY.value = Math.max(Math.min(newY, getTranslateYForIndex(0)), minY);
      }
    })
    .onEnd((event) => {
      const velocity = event.velocityY;
      const currentY = translateY.value;

      // Find closest snap point
      let closestIndex = 0;
      let closestDistance = Infinity;

      snapPointsPixels.forEach((_, index) => {
        const snapY = getTranslateYForIndex(index);
        const distance = Math.abs(currentY - snapY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      // Adjust based on velocity
      if (velocity > 500 && enablePanDownToClose) {
        // Fast swipe down - close
        currentIndex.value = -1;
        translateY.value = withSpring(SCREEN_HEIGHT, spring.modal);
        active.value = false;
        if (onClose) {
          runOnJS(onClose)();
        }
        runOnJS(notifyIndexChange)(-1);
      } else if (velocity > 200 && closestIndex > 0) {
        // Moderate swipe down - go to previous snap point
        closestIndex = Math.max(0, closestIndex - 1);
        currentIndex.value = closestIndex;
        translateY.value = withSpring(
          getTranslateYForIndex(closestIndex),
          spring.modal
        );
        runOnJS(notifyIndexChange)(closestIndex);
      } else if (velocity < -200 && closestIndex < snapPointsPixels.length - 1) {
        // Swipe up - go to next snap point
        closestIndex = Math.min(snapPointsPixels.length - 1, closestIndex + 1);
        currentIndex.value = closestIndex;
        translateY.value = withSpring(
          getTranslateYForIndex(closestIndex),
          spring.modal
        );
        runOnJS(notifyIndexChange)(closestIndex);
      } else {
        // Snap to closest point
        currentIndex.value = closestIndex;
        translateY.value = withSpring(
          getTranslateYForIndex(closestIndex),
          spring.modal
        );
        runOnJS(notifyIndexChange)(closestIndex);
      }
    });

  // Animated styles
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [SCREEN_HEIGHT, getTranslateYForIndex(0)],
      [0, backdropOpacity],
      Extrapolate.CLAMP
    ),
    pointerEvents: active.value ? 'auto' : 'none',
  }));

  // Handle indicator
  const HandleIndicator = () => (
    <View style={styles.handleContainer}>
      <View
        style={[
          styles.handle,
          { backgroundColor: theme.text.tertiary },
        ]}
      />
    </View>
  );

  const SheetContent = (
    <>
      {handleComponent || <HandleIndicator />}
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </>
  );

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          { backgroundColor: 'black' },
          backdropAnimatedStyle,
        ]}
      >
        {enableBackdropDismiss && (
          <TouchableWithoutFeedback onPress={() => ref?.current?.close()}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        )}
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom,
            },
            sheetAnimatedStyle,
            style,
          ]}
        >
          {useGlass ? (
            <GlassContainer
              variant="modal"
              intensity="strong"
              style={styles.glassSheet}
            >
              {SheetContent}
            </GlassContainer>
          ) : (
            <View
              style={[
                styles.solidSheet,
                { backgroundColor: theme.background.elevated },
              ]}
            >
              {SheetContent}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: SCREEN_HEIGHT,
    zIndex: 101,
  },
  glassSheet: {
    flex: 1,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
  },
  solidSheet: {
    flex: 1,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: semantic.modal.padding,
  },
});

BottomSheet.displayName = 'BottomSheet';

export default BottomSheet;
