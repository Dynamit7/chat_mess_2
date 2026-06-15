/**
 * VoiceMessageBubble Component
 * Complete voice message UI with waveform and playback controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../ThemeContext';
import { WaveformVisualizer } from './WaveformVisualizer';
import { glassPresets } from '../../design-system/tokens/glass';

interface VoiceMessageBubbleProps {
  audioUrl: string;
  duration: number; // in seconds
  waveformData?: number[];
  isSent?: boolean;
  timestamp?: string;
  senderName?: string;
  isRead?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (error: string) => void;
}

// Generate fake waveform if none provided
const generateFakeWaveform = (count: number = 30): number[] => {
  return Array.from({ length: count }, () => 0.2 + Math.random() * 0.8);
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({
  audioUrl,
  duration,
  waveformData,
  isSent = false,
  timestamp,
  senderName,
  isRead = false,
  onPlay,
  onPause,
  onError,
}) => {
  const { theme, isDarkMode } = useTheme();

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const playButtonScale = useSharedValue(1);
  const waveform = waveformData || generateFakeWaveform();

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Load and play audio
  const loadAndPlay = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Unload previous sound
      if (sound) {
        await sound.unloadAsync();
      }

      // Load new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
      setIsLoading(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPlay?.();
    } catch (err: any) {
      console.error('Error loading audio:', err);
      setError('Failed to load audio');
      setIsLoading(false);
      onError?.('Failed to load audio');
    }
  }, [audioUrl, sound, onPlay, onError]);

  // Pause audio
  const pauseAudio = useCallback(async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPause?.();
    }
  }, [sound, onPause]);

  // Resume audio
  const resumeAudio = useCallback(async () => {
    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPlay?.();
    }
  }, [sound, onPlay]);

  // Playback status update
  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded) {
      setProgress(status.positionMillis / status.durationMillis);
      setCurrentTime(status.positionMillis / 1000);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
      }
    }
  }, []);

  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    playButtonScale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
    setTimeout(() => {
      playButtonScale.value = withSpring(1, { damping: 10, stiffness: 300 });
    }, 100);

    if (isPlaying) {
      pauseAudio();
    } else if (sound) {
      resumeAudio();
    } else {
      loadAndPlay();
    }
  }, [isPlaying, sound, loadAndPlay, pauseAudio, resumeAudio]);

  const playButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));

  // Get colors based on sent/received
  const bubbleConfig = isSent
    ? glassPresets.messageSent
    : isDarkMode
    ? glassPresets.messageReceivedDark
    : glassPresets.messageReceived;

  const textColor = isSent ? '#FFF' : theme.colors.text.primary;
  const secondaryColor = isSent ? 'rgba(255,255,255,0.7)' : theme.colors.text.secondary;

  return (
    <View style={[styles.container, isSent && styles.containerSent]}>
      <BlurView
        intensity={bubbleConfig.blur}
        tint={isSent ? 'default' : isDarkMode ? 'dark' : 'light'}
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleConfig.backgroundColor,
            borderColor: bubbleConfig.borderColor,
            borderWidth: bubbleConfig.borderWidth,
            borderRadius: bubbleConfig.borderRadius,
          },
        ]}
      >
        <View style={styles.content}>
          {/* Sender name (for received messages) */}
          {!isSent && senderName && (
            <Text style={[styles.senderName, { color: theme.colors.brand.primary }]}>
              {senderName}
            </Text>
          )}

          <View style={styles.mainRow}>
            {/* Play/Pause Button */}
            <Animated.View style={playButtonStyle}>
              <Pressable
                onPress={togglePlayback}
                style={[
                  styles.playButton,
                  {
                    backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : theme.colors.brand.primary,
                  },
                ]}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Ionicons name="hourglass" size={20} color={isSent ? '#FFF' : '#FFF'} />
                ) : (
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={20}
                    color="#FFF"
                    style={!isPlaying && { marginLeft: 2 }}
                  />
                )}
              </Pressable>
            </Animated.View>

            {/* Waveform */}
            <View style={styles.waveformSection}>
              <WaveformVisualizer
                waveformData={waveform}
                progress={progress}
                isPlaying={isPlaying}
                duration={duration}
                currentTime={currentTime}
                barWidth={2}
                barGap={1}
                maxHeight={28}
                playedColor={isSent ? '#FFF' : theme.colors.brand.primary}
                unplayedColor={isSent ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)'}
                compact
              />
            </View>
          </View>

          {/* Footer with timestamp */}
          <View style={styles.footer}>
            <Text style={[styles.duration, { color: secondaryColor }]}>
              {formatTime(isPlaying ? currentTime : duration)}
            </Text>
            {timestamp && (
              <Text style={[styles.timestamp, { color: secondaryColor }]}>
                {timestamp}
              </Text>
            )}
            {isSent && (
              <Ionicons
                name={isRead ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={isRead ? '#60A5FA' : secondaryColor}
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
      </BlurView>

      {/* Error message */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    alignSelf: 'flex-start',
    marginVertical: 2,
    marginHorizontal: 8,
  },
  containerSent: {
    alignSelf: 'flex-end',
  },
  bubble: {
    overflow: 'hidden',
    minWidth: 200,
  },
  content: {
    padding: 10,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  waveformSection: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  duration: {
    fontSize: 11,
    flex: 1,
  },
  timestamp: {
    fontSize: 11,
    marginLeft: 8,
  },
  readIcon: {
    marginLeft: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
});

export default VoiceMessageBubble;
