import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

const MAX_DURATION = 60; // seconds

const VideoCircleRecorder = ({ visible, onClose, onVideoRecorded }) => {
  const [isUploading, setIsUploading] = useState(false);

  const recordVideo = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Ошибка', 'Необходим доступ к камере');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: MAX_DURATION,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: true,
        cameraType: ImagePicker.CameraType.front,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setIsUploading(true);
        try {
          await onVideoRecorded(result.assets[0].uri);
        } finally {
          setIsUploading(false);
        }
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Video recording error:', err);
      Alert.alert('Ошибка', 'Не удалось записать видео');
      setIsUploading(false);
    }
  };

  // Auto-launch camera when visible
  React.useEffect(() => {
    if (visible) {
      recordVideo();
    }
  }, [visible]);

  if (!visible) return null;

  if (isUploading) {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color="#7C5CFF" />
        <Text style={styles.uploadingText}>Отправка видеокружка...</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
});

export default VideoCircleRecorder;
