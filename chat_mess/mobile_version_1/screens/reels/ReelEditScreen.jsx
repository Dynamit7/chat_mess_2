/**
 * ReelEditScreen
 * Edit recorded video with filters, music, and effects
 * Super-App Messenger 2026
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import { BASE_URL } from '../../src/config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FILTERS = [
  { id: 'none', name: 'Normal', style: {} },
  { id: 'vivid', name: 'Vivid', style: { saturate: 1.3, contrast: 1.1 } },
  { id: 'warm', name: 'Warm', style: { sepia: 0.2, brightness: 1.05 } },
  { id: 'cool', name: 'Cool', style: { hueRotate: 180, saturation: 0.9 } },
  { id: 'vintage', name: 'Vintage', style: { sepia: 0.4, contrast: 1.1, brightness: 0.95 } },
  { id: 'bw', name: 'B&W', style: { grayscale: 1 } },
  { id: 'dramatic', name: 'Dramatic', style: { contrast: 1.3, brightness: 0.9 } },
];

const FilterOption = ({ filter, isSelected, onSelect }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.9, {}, () => {
      scale.value = withSpring(1);
    });
    onSelect(filter);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.filterOption, animatedStyle]}>
      <TouchableOpacity
        style={[
          styles.filterButton,
          isSelected && styles.filterButtonSelected,
        ]}
        onPress={handlePress}
      >
        <View style={[styles.filterPreview, filter.style]} />
      </TouchableOpacity>
      <Text style={[styles.filterName, isSelected && styles.filterNameSelected]}>
        {filter.name}
      </Text>
    </Animated.View>
  );
};

const ReelEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);

  const { video } = route.params || {};

  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPublic, setIsPublic] = useState(true);
  const [selectedMusic, setSelectedMusic] = useState(null);

  const handleSelectMusic = useCallback(() => {
    navigation.navigate('ReelMusicPicker', {
      onSelect: (music) => setSelectedMusic(music),
    });
  }, [navigation]);

  const handleFilterSelect = useCallback((filter) => {
    setSelectedFilter(filter);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!video?.uri) {
      Alert.alert('Error', 'No video to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please login to post reels');
        return;
      }

      // Parse hashtags
      const hashtagArray = hashtags
        .split(/[\s,#]+/)
        .filter(tag => tag.length > 0)
        .map(tag => tag.toLowerCase());

      // Create form data
      const formData = new FormData();
      formData.append('video', {
        uri: video.uri,
        type: 'video/mp4',
        name: 'reel.mp4',
      });
      formData.append('caption', caption);
      formData.append('hashtags', JSON.stringify(hashtagArray));
      formData.append('isPublic', isPublic.toString());
      formData.append('filter', selectedFilter.id);

      if (selectedMusic) {
        formData.append('musicId', selectedMusic.id);
      }

      // Upload with progress tracking
      const response = await fetch(`${BASE_URL}/api/reels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload reel');
      }

      Alert.alert('Success', 'Your reel has been posted!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('ReelsFeed'),
        },
      ]);
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', err.message || 'Failed to upload reel');
    } finally {
      setIsUploading(false);
    }
  }, [video, caption, hashtags, isPublic, selectedFilter, selectedMusic, navigation]);

  if (!video?.uri) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No video selected</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>New Reel</Text>

        <TouchableOpacity
          style={[styles.publishButton, isUploading && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.publishButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Video Preview */}
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: video.uri }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            isMuted={false}
          />

          {/* Music Overlay */}
          {selectedMusic && (
            <View style={styles.musicOverlay}>
              <Ionicons name="musical-notes" size={16} color="#fff" />
              <Text style={styles.musicText} numberOfLines={1}>
                {selectedMusic.title}
              </Text>
            </View>
          )}
        </View>

        {/* Filters */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {FILTERS.map((filter) => (
              <FilterOption
                key={filter.id}
                filter={filter}
                isSelected={selectedFilter.id === filter.id}
                onSelect={handleFilterSelect}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Add Music */}
        <Animated.View entering={FadeIn.delay(200)} style={styles.section}>
          <TouchableOpacity style={styles.addMusicButton} onPress={handleSelectMusic}>
            <View style={styles.addMusicIcon}>
              <Ionicons name="musical-notes" size={24} color="#FF2D55" />
            </View>
            <View style={styles.addMusicText}>
              <Text style={styles.addMusicTitle}>
                {selectedMusic ? selectedMusic.title : 'Add music'}
              </Text>
              <Text style={styles.addMusicSubtitle}>
                {selectedMusic ? selectedMusic.artist : 'Choose a sound'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </Animated.View>

        {/* Caption */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>Caption</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={2200}
          />
        </Animated.View>

        {/* Hashtags */}
        <Animated.View entering={FadeIn.delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Hashtags</Text>
          <TextInput
            style={styles.hashtagInput}
            placeholder="Add hashtags (e.g., #viral #fyp)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={hashtags}
            onChangeText={setHashtags}
          />
        </Animated.View>

        {/* Privacy Toggle */}
        <Animated.View entering={FadeIn.delay(500)} style={styles.section}>
          <TouchableOpacity
            style={styles.privacyToggle}
            onPress={() => setIsPublic(!isPublic)}
          >
            <View style={styles.privacyInfo}>
              <Ionicons
                name={isPublic ? 'earth' : 'lock-closed'}
                size={24}
                color="#fff"
              />
              <View style={styles.privacyText}>
                <Text style={styles.privacyTitle}>
                  {isPublic ? 'Public' : 'Private'}
                </Text>
                <Text style={styles.privacySubtitle}>
                  {isPublic
                    ? 'Anyone can see this reel'
                    : 'Only you can see this reel'}
                </Text>
              </View>
            </View>
            <View style={[styles.toggle, isPublic && styles.toggleActive]}>
              <View style={[styles.toggleKnob, isPublic && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Upload Progress Overlay */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <BlurView intensity={80} tint="dark" style={styles.uploadBlur}>
            <ActivityIndicator size="large" color="#FF2D55" />
            <Text style={styles.uploadText}>Uploading...</Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${uploadProgress}%` }]}
              />
            </View>
          </BlurView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  publishButton: {
    backgroundColor: '#FF2D55',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  videoContainer: {
    width: SCREEN_WIDTH - 32,
    height: (SCREEN_WIDTH - 32) * 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  musicOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  musicText: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  filtersContainer: {
    paddingRight: 16,
    gap: 16,
  },
  filterOption: {
    alignItems: 'center',
  },
  filterButton: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterButtonSelected: {
    borderColor: '#FF2D55',
  },
  filterPreview: {
    flex: 1,
    backgroundColor: '#333',
  },
  filterName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 6,
  },
  filterNameSelected: {
    color: '#FF2D55',
  },
  addMusicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 12,
  },
  addMusicIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,45,85,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addMusicText: {
    flex: 1,
  },
  addMusicTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  addMusicSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hashtagInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 12,
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyText: {
    marginLeft: 12,
  },
  privacyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  privacySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#FF2D55',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBlur: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
  },
  uploadText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF2D55',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#FF2D55',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReelEditScreen;
