/**
 * ReelPlayer Component
 * Full-screen video player for Reels
 * Super-App Messenger 2026
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ReelPlayer = memo(({
  videoUrl,
  thumbnailUrl,
  isActive = false,
  isMuted = false,
  onPlaybackStatusUpdate,
  onDoubleTap,
  onSingleTap,
  style,
}) => {
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  const lastTap = useRef(0);
  const playIconOpacity = useSharedValue(0);
  const playIconScale = useSharedValue(0.5);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  // Setup audio mode
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  }, []);

  // Handle active state changes
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.playAsync();
        setIsPlaying(true);
      } else {
        videoRef.current.pauseAsync();
        videoRef.current.setPositionAsync(0);
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  // Handle mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setIsMutedAsync(isMuted);
    }
  }, [isMuted]);

  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setIsPlaying(status.isPlaying);

      // Loop video
      if (status.didJustFinish) {
        videoRef.current?.replayAsync();
      }
    }

    onPlaybackStatusUpdate?.(status);
  }, [onPlaybackStatusUpdate]);

  const showPlayPauseIcon = useCallback((isPaused) => {
    setShowPlayIcon(isPaused);
    playIconOpacity.value = withTiming(1, { duration: 150 });
    playIconScale.value = withSpring(1, { damping: 10 });

    setTimeout(() => {
      playIconOpacity.value = withTiming(0, { duration: 300 });
      playIconScale.value = withTiming(0.5, { duration: 300 });
    }, 500);
  }, []);

  const showHeartAnimation = useCallback(() => {
    heartScale.value = 0;
    heartOpacity.value = 1;
    heartScale.value = withSpring(1.2, { damping: 8 });

    setTimeout(() => {
      heartOpacity.value = withTiming(0, { duration: 300 });
    }, 600);
  }, []);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap - like
      runOnJS(showHeartAnimation)();
      onDoubleTap?.();
      lastTap.current = 0;
    } else {
      // Single tap - pause/play
      lastTap.current = now;

      setTimeout(() => {
        if (lastTap.current !== 0 && Date.now() - lastTap.current >= DOUBLE_TAP_DELAY) {
          if (videoRef.current) {
            if (isPlaying) {
              videoRef.current.pauseAsync();
              runOnJS(showPlayPauseIcon)(true);
            } else {
              videoRef.current.playAsync();
              runOnJS(showPlayPauseIcon)(false);
            }
          }
          onSingleTap?.();
          lastTap.current = 0;
        }
      }, DOUBLE_TAP_DELAY);
    }
  }, [isPlaying, onDoubleTap, onSingleTap, showHeartAnimation, showPlayPauseIcon]);

  const playIconStyle = useAnimatedStyle(() => ({
    opacity: playIconOpacity.value,
    transform: [{ scale: playIconScale.value }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={[styles.container, style]}>
        {/* Video */}
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          posterSource={{ uri: thumbnailUrl }}
          posterStyle={styles.poster}
          usePoster={!!thumbnailUrl}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive}
          isLooping
          isMuted={isMuted}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Play/Pause Icon */}
        <Animated.View style={[styles.playIconContainer, playIconStyle]} pointerEvents="none">
          <View style={styles.playIconBackground}>
            <Ionicons
              name={showPlayIcon ? 'pause' : 'play'}
              size={50}
              color="#fff"
            />
          </View>
        </Animated.View>

        {/* Heart Animation (double tap like) */}
        <Animated.View style={[styles.heartContainer, heartStyle]} pointerEvents="none">
          <Ionicons name="heart" size={100} color="#FF2D55" />
        </Animated.View>

        {/* Bottom Gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.bottomGradient}
          pointerEvents="none"
        />

        {/* Top Gradient */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent']}
          style={styles.topGradient}
          pointerEvents="none"
        />
      </View>
    </TouchableWithoutFeedback>
  );
});

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playIconContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
});

ReelPlayer.displayName = 'ReelPlayer';

export default ReelPlayer;
