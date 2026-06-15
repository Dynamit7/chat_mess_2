/**
 * ReelRecordScreen
 * Camera screen for recording new Reels
 * Super-App Messenger 2026
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import VideoRecorder from '../../components/reels/VideoRecorder';

const ReelRecordScreen = () => {
  const navigation = useNavigation();

  const handleVideoRecorded = useCallback((video) => {
    // Navigate to edit screen with recorded video
    navigation.navigate('ReelEdit', { video });
  }, [navigation]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <VideoRecorder
        onVideoRecorded={handleVideoRecorded}
        onClose={handleClose}
        maxDuration={60}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default ReelRecordScreen;
