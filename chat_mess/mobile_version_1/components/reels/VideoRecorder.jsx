/**
 * VideoRecorder Component
 * Camera component for recording Reels
 * Super-App Messenger 2026
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { Camera, CameraType, FlashMode } from 'expo-camera';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_DURATION = 60; // 60 seconds max

const VideoRecorder = memo(({
  onVideoRecorded,
  onClose,
  maxDuration = MAX_DURATION,
}) => {
  const cameraRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraType, setCameraType] = useState(CameraType.back);
  const [flashMode, setFlashMode] = useState(FlashMode.off);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [zoom, setZoom] = useState(0);

  const recordingProgress = useSharedValue(0);
  const recordButtonScale = useSharedValue(1);
  const recordButtonInnerScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  const timerRef = useRef(null);

  // Request permissions
  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const audioPermission = await Audio.requestPermissionsAsync();
      const mediaPermission = await MediaLibrary.requestPermissionsAsync();

      setHasPermission(
        cameraPermission.status === 'granted' &&
        audioPermission.status === 'granted' &&
        mediaPermission.status === 'granted'
      );
    })();
  }, []);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, maxDuration]);

  // Recording animation
  useEffect(() => {
    if (isRecording) {
      recordButtonScale.value = withTiming(1.2, { duration: 200 });
      recordButtonInnerScale.value = withTiming(0.5, { duration: 200 });
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.3, { duration: 500 })
        ),
        -1,
        true
      );
      recordingProgress.value = withTiming(1, {
        duration: maxDuration * 1000,
        easing: Easing.linear,
      });
    } else {
      recordButtonScale.value = withTiming(1, { duration: 200 });
      recordButtonInnerScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0, { duration: 200 });
      recordingProgress.value = 0;
    }
  }, [isRecording, maxDuration]);

  const startRecording = useCallback(async () => {
    if (cameraRef.current && !isRecording) {
      setIsRecording(true);
      setRecordingDuration(0);

      try {
        const video = await cameraRef.current.recordAsync({
          maxDuration: maxDuration,
          quality: Camera.Constants?.VideoQuality?.['1080p'] || '1080p',
          mute: false,
        });

        onVideoRecorded?.(video);
      } catch (error) {
        console.error('Recording error:', error);
        Alert.alert('Error', 'Failed to record video');
      } finally {
        setIsRecording(false);
        setRecordingDuration(0);
      }
    }
  }, [isRecording, maxDuration, onVideoRecorded]);

  const stopRecording = useCallback(async () => {
    if (cameraRef.current && isRecording) {
      await cameraRef.current.stopRecording();
    }
  }, [isRecording]);

  const toggleCameraType = useCallback(() => {
    setCameraType((current) =>
      current === CameraType.back ? CameraType.front : CameraType.back
    );
  }, []);

  const toggleFlash = useCallback(() => {
    setFlashMode((current) => {
      switch (current) {
        case FlashMode.off:
          return FlashMode.on;
        case FlashMode.on:
          return FlashMode.auto;
        default:
          return FlashMode.off;
      }
    });
  }, []);

  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getFlashIcon = useCallback(() => {
    switch (flashMode) {
      case FlashMode.on:
        return 'flash';
      case FlashMode.auto:
        return 'flash-outline';
      default:
        return 'flash-off';
    }
  }, [flashMode]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${recordingProgress.value * 100}%`,
  }));

  const recordButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordButtonScale.value }],
  }));

  const recordButtonInnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordButtonInnerScale.value }],
    borderRadius: recordButtonInnerScale.value === 1 ? 30 : 8,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera and microphone access required
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        flashMode={flashMode}
        zoom={zoom}
        ratio="16:9"
      >
        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.controlButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.topRightControls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              <Ionicons name={getFlashIcon()} size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {/* Speed settings */}}
            >
              <Text style={styles.speedText}>1x</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recording Duration */}
        {isRecording && (
          <View style={styles.durationContainer}>
            <Animated.View style={[styles.recordingPulse, pulseStyle]} />
            <View style={styles.recordingDot} />
            <Text style={styles.durationText}>
              {formatDuration(recordingDuration)}
            </Text>
          </View>
        )}

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Animated.View style={[styles.progressBar, progressStyle]} />
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {/* Gallery */}
          <TouchableOpacity style={styles.sideButton}>
            <BlurView intensity={30} style={styles.blurButton}>
              <Ionicons name="images" size={24} color="#fff" />
            </BlurView>
          </TouchableOpacity>

          {/* Record Button */}
          <Animated.View style={[styles.recordButtonOuter, recordButtonStyle]}>
            <TouchableOpacity
              style={styles.recordButtonTouchable}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Animated.View style={[styles.recordButtonInner, recordButtonInnerStyle]} />
            </TouchableOpacity>
          </Animated.View>

          {/* Flip Camera */}
          <TouchableOpacity style={styles.sideButton} onPress={toggleCameraType}>
            <BlurView intensity={30} style={styles.blurButton}>
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </BlurView>
          </TouchableOpacity>
        </View>

        {/* Effects Button */}
        <TouchableOpacity style={styles.effectsButton}>
          <BlurView intensity={30} style={styles.effectsBlur}>
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.effectsText}>Effects</Text>
          </BlurView>
        </TouchableOpacity>

        {/* Music Button */}
        <TouchableOpacity style={styles.musicButton}>
          <BlurView intensity={30} style={styles.musicBlur}>
            <Ionicons name="musical-notes" size={20} color="#fff" />
            <Text style={styles.musicText}>Add sound</Text>
          </BlurView>
        </TouchableOpacity>
      </Camera>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  topRightControls: {
    flexDirection: 'row',
    gap: 16,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  recordingPulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF2D55',
    left: -20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF2D55',
  },
  durationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF2D55',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  sideButton: {
    width: 50,
    height: 50,
  },
  blurButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  recordButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonTouchable: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    backgroundColor: '#FF2D55',
  },
  effectsButton: {
    position: 'absolute',
    left: 20,
    bottom: 140,
  },
  effectsBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
    gap: 6,
  },
  effectsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  musicButton: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
  },
  musicBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
    gap: 6,
  },
  musicText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FF2D55',
    borderRadius: 8,
    alignSelf: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

VideoRecorder.displayName = 'VideoRecorder';

export default VideoRecorder;
