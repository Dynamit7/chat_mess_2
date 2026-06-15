/**
 * RecordingIndicator Component
 * Shows recording state with live waveform visualization
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../ThemeContext';

interface RecordingIndicatorProps {
  isRecording: boolean;
  audioLevel: number; // 0-1 normalized
  duration: number; // in milliseconds
  onCancel: () => void;
  onSend: () => void;
  onPause?: () => void;
  isPaused?: boolean;
}

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({
  isRecording,
  audioLevel,
  duration,
  onCancel,
  onSend,
  onPause,
  isPaused = false,
}) => {
  const { theme, isDarkMode } = useTheme();

  const pulseScale = useSharedValue(1);
  const wavePhase = useSharedValue(0);
  const audioLevelValue = useSharedValue(0);
  const slideX = useSharedValue(0);

  // Pulse animation for recording dot
  useEffect(() => {
    if (isRecording && !isPaused) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );

      wavePhase.value = withRepeat(
        withTiming(2 * Math.PI, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(wavePhase);
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording, isPaused]);

  // Update audio level
  useEffect(() => {
    audioLevelValue.value = withSpring(audioLevel, { damping: 15, stiffness: 300 });
  }, [audioLevel]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const waveStyle = useAnimatedStyle(() => {
    const amplitude = audioLevelValue.value * 20;
    return {
      height: 20 + amplitude,
    };
  });

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCancel();
  };

  const handleSend = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSend();
  };

  // Generate wave bars
  const waveBars = Array.from({ length: 20 }, (_, i) => {
    const baseHeight = 4;
    const maxHeight = 24;
    const height = baseHeight + (audioLevel * maxHeight * Math.sin((i / 20) * Math.PI));

    return (
      <Animated.View
        key={i}
        style={[
          styles.waveBar,
          {
            height,
            backgroundColor: theme.colors.brand.primary,
            opacity: 0.6 + (audioLevel * 0.4),
          },
        ]}
      />
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)' }]}>
      {/* Cancel Button */}
      <Pressable onPress={handleCancel} style={styles.cancelButton}>
        <Ionicons name="trash-outline" size={24} color="#EF4444" />
      </Pressable>

      {/* Recording Info */}
      <View style={styles.centerSection}>
        {/* Recording Dot */}
        <Animated.View style={[styles.recordDot, pulseStyle]}>
          <View style={styles.innerDot} />
        </Animated.View>

        {/* Waveform */}
        <View style={styles.waveContainer}>
          {waveBars}
        </View>

        {/* Duration */}
        <Text style={[styles.duration, { color: theme.colors.text.primary }]}>
          {formatDuration(duration)}
        </Text>
      </View>

      {/* Pause/Resume Button */}
      {onPause && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPause();
          }}
          style={styles.pauseButton}
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={24}
            color={theme.colors.brand.primary}
          />
        </Pressable>
      )}

      {/* Send Button */}
      <Pressable onPress={handleSend} style={[styles.sendButton, { backgroundColor: theme.colors.brand.primary }]}>
        <Ionicons name="send" size={20} color="#FFF" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  recordDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  waveContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  duration: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 40,
    textAlign: 'right',
  },
  pauseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RecordingIndicator;
