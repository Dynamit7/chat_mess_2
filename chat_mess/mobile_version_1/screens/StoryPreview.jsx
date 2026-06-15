import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import Icon from '@expo/vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';
import { BASE_URL } from '../src/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import emitter from './eventEmitter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const StoryPreview = ({ route, navigation }) => {
  const { stories, username, storyOwnerId, currentUserId, initialIndex = 0 } = route.params;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [progress] = useState(new Animated.Value(0));
  const [paused, setPaused] = useState(false);

  // Viewers state
  const [viewersVisible, setViewersVisible] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewCount, setViewCount] = useState(0);

  const currentStory = stories[currentIndex];
  const isOwnStory = Number(storyOwnerId) === Number(currentUserId);
  const viewedIdsRef = useRef([]);

  // Record view when story changes
  useEffect(() => {
    if (currentStory?.id && currentUserId) {
      recordView(currentStory.id);
    }
  }, [currentIndex]);

  // On unmount: save viewed IDs to AsyncStorage and notify Stories screen
  useEffect(() => {
    return () => {
      if (viewedIdsRef.current.length > 0 && currentUserId) {
        emitter.emit('storiesViewed', [...viewedIdsRef.current]);
        const key = `viewedStoryIds_${currentUserId}`;
        const getStorage = Platform.OS === 'web'
          ? Promise.resolve(localStorage.getItem(key))
          : AsyncStorage.getItem(key);
        getStorage.then(existing => {
          const existingIds = existing ? JSON.parse(existing) : [];
          const merged = [...new Set([...existingIds, ...viewedIdsRef.current])];
          const value = JSON.stringify(merged);
          if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
          } else {
            AsyncStorage.setItem(key, value);
          }
        }).catch(() => {});
      }
    };
  }, []);

  // Fetch view count for own stories
  useEffect(() => {
    if (isOwnStory && currentStory?.id) {
      fetchViewers(currentStory.id);
    }
  }, [currentIndex, isOwnStory]);

  const recordView = async (storyId) => {
    try {
      if (!viewedIdsRef.current.includes(storyId)) {
        viewedIdsRef.current = [...viewedIdsRef.current, storyId];
      }
      await fetch(`${BASE_URL}/api/stories/${storyId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewerId: currentUserId }),
      });
    } catch (err) {
      console.error('Error recording view:', err);
    }
  };

  const fetchViewers = async (storyId) => {
    try {
      const res = await fetch(`${BASE_URL}/api/stories/${storyId}/viewers`);
      if (res.ok) {
        const data = await res.json();
        setViewers(data);
        setViewCount(data.length);
      }
    } catch (err) {
      console.error('Error fetching viewers:', err);
    }
  };

  // Set loading only when navigating to a new story
  useEffect(() => {
    if (currentStory?.type === 'image') {
      setLoading(true);
    }
  }, [currentIndex]);

  // Progress animation
  useEffect(() => {
    if (!paused) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) handleNext();
      });
    }

    return () => progress.stopAnimation();
  }, [currentIndex, paused]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      progress.setValue(0);
    } else {
      navigation.goBack();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      progress.setValue(0);
    }
  };

  const handlePress = (evt) => {
    const tapX = evt.nativeEvent.locationX;
    if (tapX < SCREEN_WIDTH / 3) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  const openViewers = useCallback(() => {
    setPaused(true);
    if (currentStory?.id) {
      fetchViewers(currentStory.id);
    }
    setViewersVisible(true);
  }, [currentStory]);

  const closeViewers = useCallback(() => {
    setViewersVisible(false);
    setPaused(false);
  }, []);

  const isValidUrl = (url) => typeof url === 'string' && url.startsWith('http');

  // Stable interpolation — created once since progress never changes reference
  const activeBarWidth = useMemo(() => progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  }), [progress]);

  // Stable style array — new array on every render causes Animated.View to re-trigger on web
  const activeBarStyle = useMemo(
    () => [styles.progressBar, { width: activeBarWidth }],
    [activeBarWidth]
  );

  const renderProgressBars = () => (
    <View style={styles.progressBarContainer}>
      {stories.map((_, index) => {
        if (index < currentIndex) {
          return (
            <View key={index} style={styles.progressBarBackground}>
              <View style={[styles.progressBar, { width: '100%' }, styles.progressBarComplete]} />
            </View>
          );
        } else if (index === currentIndex) {
          return (
            <View key={index} style={styles.progressBarBackground}>
              <Animated.View style={activeBarStyle} />
            </View>
          );
        } else {
          return (
            <View key={index} style={styles.progressBarBackground}>
              <View style={[styles.progressBar, { width: '0%' }]} />
            </View>
          );
        }
      })}
    </View>
  );

  const renderViewerItem = ({ item }) => {
    const viewer = item.viewer;
    const avatarUrl = viewer?.avatar?.startsWith('http')
      ? viewer.avatar
      : viewer?.avatar ? `${BASE_URL}${viewer.avatar}` : null;

    return (
      <View style={styles.viewerItem}>
        {avatarUrl ? (
          <Image style={styles.viewerAvatar} source={{ uri: avatarUrl }} />
        ) : (
          <LinearGradient colors={['#7C5CFF', '#9070FF']} style={styles.viewerAvatarPlaceholder}>
            <Text style={styles.viewerAvatarLetter}>
              {viewer?.username?.charAt(0)?.toUpperCase()}
            </Text>
          </LinearGradient>
        )}
        <Text style={styles.viewerName}>{viewer?.username || 'Unknown'}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderProgressBars()}

      <View style={styles.header}>
        <View style={styles.userInfo}>
          {currentStory?.owner?.avatar && isValidUrl(currentStory.owner.avatar) ? (
            <Image source={{ uri: currentStory.owner.avatar }} style={styles.userAvatar} />
          ) : null}
          <Text style={styles.username}>{username || 'Unknown'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>×</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.contentContainer}
        activeOpacity={1}
        onPress={handlePress}
        onLongPress={() => setPaused(true)}
        onPressOut={() => { if (!viewersVisible) setPaused(false); }}
      >
        {currentStory?.type === 'image' ? (
          <View style={styles.imageContainer}>
            {loading && (
              <ActivityIndicator size="large" color="#fff" style={styles.loader} />
            )}
            {isValidUrl(currentStory?.fileUrl) ? (
              <Image
                source={{ uri: currentStory.fileUrl }}
                style={styles.content}
                resizeMode="contain"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  console.log('Failed to load image:', currentStory.fileUrl);
                }}
              />
            ) : (
              <Text style={styles.errorText}>Invalid image URL</Text>
            )}
          </View>
        ) : (
          <View style={styles.videoContainer}>
            <Text style={styles.videoText}>Video content</Text>
          </View>
        )}
      </TouchableOpacity>

      {currentStory?.caption ? (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>{currentStory.caption}</Text>
        </View>
      ) : null}

      {/* Eye icon - viewers button (only for own stories) */}
      {isOwnStory && (
        <TouchableOpacity style={styles.eyeButton} onPress={openViewers} activeOpacity={0.7}>
          <LinearGradient
            colors={['rgba(124, 92, 255, 0.8)', 'rgba(200,80,192,0.8)']}
            style={styles.eyeGradient}
          >
            <Icon name="eye" size={18} color="#fff" />
            <Text style={styles.eyeCount}>{viewCount}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Viewers Modal */}
      <Modal
        visible={viewersVisible}
        transparent
        animationType="slide"
        onRequestClose={closeViewers}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={closeViewers} activeOpacity={1} />

          <View style={styles.modalContent}>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Icon name="eye" size={16} color="#7C5CFF" />
                <Text style={styles.modalTitle}>
                  {viewCount} {viewCount === 1 ? 'viewer' : 'viewers'}
                </Text>
              </View>
              <TouchableOpacity onPress={closeViewers}>
                <Icon name="times" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Viewers list */}
            {viewers.length > 0 ? (
              <FlatList
                data={viewers}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderViewerItem}
                contentContainerStyle={styles.viewersList}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyViewers}>
                <Icon name="eye-slash" size={30} color="#ccc" />
                <Text style={styles.emptyViewersText}>No viewers yet</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 5,
    paddingTop: 10,
    justifyContent: 'space-between',
  },
  progressBarBackground: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  progressBarComplete: {
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 30,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoText: {
    color: '#fff',
    fontSize: 20,
  },
  loader: {
    position: 'absolute',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  caption: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },

  // Eye button
  eyeButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
  },
  eyeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    gap: 8,
  },
  eyeCount: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '55%',
    minHeight: 200,
    paddingBottom: 30,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#121826',
  },
  viewersList: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
  },
  viewerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerAvatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#121826',
  },
  emptyViewers: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyViewersText: {
    fontSize: 15,
    color: '#999',
  },
});

export default StoryPreview;
