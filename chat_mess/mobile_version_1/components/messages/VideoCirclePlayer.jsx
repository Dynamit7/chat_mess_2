import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { fixFileUrl } from '../../src/config';

const CIRCLE_SIZE = 200;

const VideoCirclePlayer = ({ uri: rawUri, style }) => {
  const uri = fixFileUrl(rawUri);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const handlePress = useCallback(async () => {
    // Enable audio playback even in silent mode
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        setIsMuted(false);
        await videoRef.current.setIsMutedAsync(false);
        const status = await videoRef.current.getStatusAsync();
        if (status.positionMillis >= status.durationMillis - 100) {
          await videoRef.current.replayAsync({ shouldPlay: true, isMuted: false });
        } else {
          await videoRef.current.playAsync();
        }
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('VideoCirclePlayer playback error:', err);
    }
  }, [isPlaying]);

  const handleMuteToggle = useCallback((e) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.setIsMutedAsync(newMuted);
    }
  }, [isMuted]);

  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      if (!isLoaded) setIsLoaded(true);
      setIsBuffering(status.isBuffering || false);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setIsMuted(true);
      }
    }
  }, [isLoaded]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback((error) => {
    console.error('VideoCirclePlayer load error:', error);
  }, []);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      style={[styles.container, style]}
    >
      <View style={styles.circleWrapper}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isMuted={isMuted}
          shouldPlay={false}
          isLooping={false}
          useNativeControls={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onLoad={handleLoad}
          onError={handleError}
          videoStyle={styles.video}
          posterStyle={styles.video}
        />

        {/* Loading indicator */}
        {!isLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#7C5CFF" />
          </View>
        )}

        {/* Buffering indicator */}
        {isBuffering && isPlaying && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}

        {/* Play button overlay */}
        {!isPlaying && isLoaded && (
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={32} color="#fff" />
            </View>
          </View>
        )}

        {/* Mute toggle button */}
        {isPlaying && (
          <TouchableOpacity
            style={styles.muteButton}
            onPress={handleMuteToggle}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-high'}
              size={16}
              color="#fff"
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  circleWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#7C5CFF',
    backgroundColor: '#000',
  },
  video: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  muteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VideoCirclePlayer;
