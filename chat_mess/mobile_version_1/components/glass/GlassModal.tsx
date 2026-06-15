/**
 * GlassModal Component
 * A modal with frosted glass backdrop and smooth animations
 */

import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  Dimensions,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassTint, glassPresets, blurIntensity } from '../../design-system/tokens/glass';
import { zIndex } from '../../design-system';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GlassModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'center' | 'bottom' | 'top';
  backdropIntensity?: number;
  backdropTint?: GlassTint;
  contentIntensity?: number;
  contentTint?: GlassTint;
  closeOnBackdrop?: boolean;
  hapticOnOpen?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  animationType?: 'spring' | 'fade' | 'slide';
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const GlassModal: React.FC<GlassModalProps> = ({
  visible,
  onClose,
  children,
  position = 'center',
  backdropIntensity = 50,
  backdropTint = 'dark',
  contentIntensity = 75,
  contentTint = 'light',
  closeOnBackdrop = true,
  hapticOnOpen = true,
  style,
  contentStyle,
  animationType = 'spring',
}) => {
  const backdropOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.9);
  const contentTranslateY = useSharedValue(position === 'bottom' ? 300 : position === 'top' ? -300 : 0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Opening animation
      if (hapticOnOpen) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      backdropOpacity.value = withTiming(1, { duration: 200 });

      if (animationType === 'spring') {
        contentScale.value = withSpring(1, { damping: 15, stiffness: 200 });
        contentOpacity.value = withTiming(1, { duration: 150 });
        if (position !== 'center') {
          contentTranslateY.value = withSpring(0, { damping: 18, stiffness: 180 });
        }
      } else if (animationType === 'fade') {
        contentScale.value = withTiming(1, { duration: 200 });
        contentOpacity.value = withTiming(1, { duration: 200 });
      } else {
        contentTranslateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
        contentOpacity.value = withTiming(1, { duration: 200 });
        contentScale.value = 1;
      }
    } else {
      // Closing animation
      backdropOpacity.value = withTiming(0, { duration: 150 });
      contentOpacity.value = withTiming(0, { duration: 100 });
      contentScale.value = withTiming(0.9, { duration: 150 });
      if (position !== 'center') {
        contentTranslateY.value = withTiming(position === 'bottom' ? 300 : -300, { duration: 200 });
      }
    }
  }, [visible, position, animationType, hapticOnOpen]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
      transform: [
        { scale: contentScale.value },
        { translateY: contentTranslateY.value },
      ] as const,
    };
  });

  const handleBackdropPress = () => {
    if (closeOnBackdrop) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
    }
  };

  const positionStyles = {
    center: {
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    bottom: {
      justifyContent: 'flex-end' as const,
      alignItems: 'center' as const,
    },
    top: {
      justifyContent: 'flex-start' as const,
      alignItems: 'center' as const,
      paddingTop: 100,
    },
  };
  const positionStyle = positionStyles[position];

  const glassConfig = glassPresets[`modal${backdropTint === 'light' ? 'Light' : 'Dark'}` as keyof typeof glassPresets];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, positionStyle, style]}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
            <BlurView
              intensity={backdropIntensity}
              tint={backdropTint}
              style={StyleSheet.absoluteFill}
            >
              <View style={[StyleSheet.absoluteFill, styles.backdropOverlay]} />
            </BlurView>
          </Pressable>
        </Animated.View>

        {/* Content */}
        <Animated.View style={[styles.contentWrapper, contentAnimatedStyle]}>
          <BlurView
            intensity={contentIntensity}
            tint={contentTint}
            style={[
              styles.content,
              {
                borderRadius: glassConfig.borderRadius,
                borderWidth: glassConfig.borderWidth,
                borderColor: glassConfig.borderColor,
              },
              contentStyle,
            ]}
          >
            <View
              style={[
                styles.contentInner,
                { backgroundColor: glassConfig.backgroundColor },
              ]}
            >
              {children}
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: zIndex.modal,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: zIndex.backdrop,
  },
  backdropOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  contentWrapper: {
    zIndex: zIndex.modal,
    maxWidth: SCREEN_WIDTH - 32,
    maxHeight: SCREEN_HEIGHT - 200,
  },
  content: {
    overflow: 'hidden',
  },
  contentInner: {
    padding: 20,
  },
});

export default GlassModal;
