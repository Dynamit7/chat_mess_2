/**
 * GlassMessageBubble Component
 * A chat message bubble with glassmorphism effect
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeInRight,
  FadeInLeft,
  SlideInRight,
  SlideInLeft,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { glassPresets, glassRadius } from '../../design-system/tokens/glass';
import { neutralPalette, primaryPalette } from '../../design-system/tokens/colors';
import { messageShadows } from '../../design-system/tokens/shadows';

interface GlassMessageBubbleProps {
  children: React.ReactNode;
  isSent?: boolean;
  variant?: 'light' | 'dark' | 'oled';
  showTail?: boolean;
  timestamp?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  onLongPress?: () => void;
  onPress?: () => void;
  enableGlass?: boolean;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
  index?: number;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export const GlassMessageBubble: React.FC<GlassMessageBubbleProps> = ({
  children,
  isSent = false,
  variant = 'light',
  showTail = true,
  timestamp,
  status,
  onLongPress,
  onPress,
  enableGlass = true,
  style,
  animated = true,
  index = 0,
}) => {
  const scale = useSharedValue(1);

  // Get glass configuration based on sent/received and variant
  const getGlassConfig = () => {
    if (isSent) {
      return glassPresets.messageSent;
    }
    if (variant === 'dark' || variant === 'oled') {
      return glassPresets.messageReceivedDark;
    }
    return glassPresets.messageReceived;
  };

  const glassConfig = getGlassConfig();
  const isDark = variant === 'dark' || variant === 'oled';

  // Colors
  const textColor = isSent ? neutralPalette[0] : isDark ? neutralPalette[100] : neutralPalette[900];
  const timestampColor = isSent
    ? 'rgba(255, 255, 255, 0.7)'
    : isDark
    ? neutralPalette[400]
    : neutralPalette[500];

  // Shadow
  const shadowStyle = isSent ? messageShadows.sent : messageShadows.received;

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress?.();
  };

  const pressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Entry animation
  const EntryAnimation = isSent
    ? SlideInRight.springify().damping(15).stiffness(120).delay(index * 50)
    : SlideInLeft.springify().damping(15).stiffness(120).delay(index * 50);

  const containerStyle: ViewStyle = {
    alignSelf: isSent ? 'flex-end' : 'flex-start',
    maxWidth: '80%',
    marginVertical: 2,
    marginHorizontal: 8,
  };

  const bubbleStyle: ViewStyle = {
    borderRadius: glassConfig.borderRadius,
    borderTopRightRadius: isSent && showTail ? 4 : glassConfig.borderRadius,
    borderTopLeftRadius: !isSent && showTail ? 4 : glassConfig.borderRadius,
    overflow: 'hidden',
    ...shadowStyle,
  };

  const contentStyle: ViewStyle = {
    backgroundColor: enableGlass ? glassConfig.backgroundColor : isSent ? primaryPalette[500] : isDark ? neutralPalette[800] : neutralPalette[100],
    borderWidth: enableGlass ? glassConfig.borderWidth : 0,
    borderColor: glassConfig.borderColor,
    borderRadius: glassConfig.borderRadius,
    borderTopRightRadius: isSent && showTail ? 4 : glassConfig.borderRadius,
    borderTopLeftRadius: !isSent && showTail ? 4 : glassConfig.borderRadius,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
  };

  const renderContent = () => (
    <View style={contentStyle}>
      {typeof children === 'string' ? (
        <Text style={[styles.messageText, { color: textColor }]}>{children}</Text>
      ) : (
        children
      )}
      {(timestamp || status) && (
        <View style={styles.footer}>
          {timestamp && (
            <Text style={[styles.timestamp, { color: timestampColor }]}>{timestamp}</Text>
          )}
          {status && isSent && (
            <Text style={[styles.status, { color: timestampColor }]}>
              {status === 'read' ? '✓✓' : status === 'delivered' ? '✓✓' : status === 'sent' ? '✓' : '○'}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const bubble = (
    <Animated.View
      style={[containerStyle, animated && pressAnimatedStyle, style]}
      entering={animated ? EntryAnimation : undefined}
    >
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={300}
      >
        {enableGlass ? (
          <BlurView intensity={glassConfig.blur} tint={isSent ? 'default' : variant === 'dark' ? 'dark' : 'light'} style={bubbleStyle}>
            {renderContent()}
          </BlurView>
        ) : (
          <View style={bubbleStyle}>{renderContent()}</View>
        )}
      </Pressable>
    </Animated.View>
  );

  return bubble;
};

const styles = StyleSheet.create({
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  status: {
    fontSize: 11,
    marginLeft: 4,
  },
});

export default GlassMessageBubble;
