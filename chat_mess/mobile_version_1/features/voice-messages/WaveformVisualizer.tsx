/**
 * WaveformVisualizer Component
 * Displays audio waveform with playback progress
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolate,
  FadeIn,
} from 'react-native-reanimated';
import { useTheme } from '../../ThemeContext';

interface WaveformVisualizerProps {
  waveformData: number[]; // Normalized amplitude values 0-1
  progress: number; // Playback progress 0-1
  isPlaying: boolean;
  duration: number; // Total duration in seconds
  currentTime?: number; // Current time in seconds
  barWidth?: number;
  barGap?: number;
  maxHeight?: number;
  playedColor?: string;
  unplayedColor?: string;
  compact?: boolean;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  waveformData,
  progress,
  isPlaying,
  duration,
  currentTime,
  barWidth = 3,
  barGap = 2,
  maxHeight = 40,
  playedColor,
  unplayedColor,
  compact = false,
}) => {
  const { theme, isDarkMode } = useTheme();

  const finalPlayedColor = playedColor || theme.colors.brand.primary;
  const finalUnplayedColor = unplayedColor || (isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)');

  const playedIndex = Math.floor(waveformData.length * progress);
  const displayTime = currentTime !== undefined ? currentTime : progress * duration;

  // Generate waveform bars
  const bars = useMemo(() => {
    return waveformData.map((amplitude, index) => {
      const height = Math.max(4, amplitude * maxHeight);
      const isPlayed = index < playedIndex;

      return {
        height,
        isPlayed,
        index,
      };
    });
  }, [waveformData, playedIndex, maxHeight]);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.waveformContainer}>
        {bars.map((bar, index) => (
          <Animated.View
            key={index}
            entering={FadeIn.delay(index * 10).duration(200)}
            style={[
              styles.bar,
              {
                height: bar.height,
                backgroundColor: bar.isPlayed ? finalPlayedColor : finalUnplayedColor,
                width: barWidth,
                marginHorizontal: barGap / 2,
              },
            ]}
          />
        ))}
      </View>

      {!compact && (
        <View style={styles.timeContainer}>
          <Text style={[styles.timeText, { color: theme.colors.text.secondary }]}>
            {formatTime(displayTime)}
          </Text>
          <Text style={[styles.timeText, { color: theme.colors.text.tertiary }]}>
            {formatTime(duration)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  containerCompact: {
    paddingVertical: 4,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  bar: {
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
  },
});

export default WaveformVisualizer;
