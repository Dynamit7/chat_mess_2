/**
 * ReelsFeedScreen
 * TikTok-style vertical swipe feed for Reels
 * Super-App Messenger 2026
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ReelPlayer from '../../components/reels/ReelPlayer';
import ReelOverlay from '../../components/reels/ReelOverlay';
import ReelInfo from '../../components/reels/ReelInfo';
import { BASE_URL } from '../../src/config';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const ReelItem = memo(({
  item,
  index,
  activeIndex,
  isMuted,
  onLike,
  onComment,
  onShare,
  onSave,
  onUserPress,
  onMusicPress,
  onHashtagPress,
  onDoubleTapLike,
}) => {
  const isActive = index === activeIndex;
  const [isLiked, setIsLiked] = useState(item.isLiked || false);
  const [isSaved, setIsSaved] = useState(item.isSaved || false);

  const handleLike = useCallback(() => {
    setIsLiked(!isLiked);
    onLike?.(item.id, !isLiked);
  }, [item.id, isLiked, onLike]);

  const handleSave = useCallback(() => {
    setIsSaved(!isSaved);
    onSave?.(item.id, !isSaved);
  }, [item.id, isSaved, onSave]);

  const handleDoubleTap = useCallback(() => {
    if (!isLiked) {
      setIsLiked(true);
      onLike?.(item.id, true);
    }
    onDoubleTapLike?.(item.id);
  }, [item.id, isLiked, onLike, onDoubleTapLike]);

  return (
    <View style={styles.reelContainer}>
      <ReelPlayer
        videoUrl={item.videoUrl}
        thumbnailUrl={item.thumbnailUrl}
        isActive={isActive}
        isMuted={isMuted}
        onDoubleTap={handleDoubleTap}
      />

      <ReelOverlay
        reel={item}
        isLiked={isLiked}
        isSaved={isSaved}
        isPlaying={isActive}
        onLike={handleLike}
        onComment={() => onComment?.(item)}
        onShare={() => onShare?.(item)}
        onSave={handleSave}
        onUserPress={() => onUserPress?.(item.user)}
        onMusicPress={() => onMusicPress?.(item.music)}
      />

      <ReelInfo
        reel={item}
        onUserPress={() => onUserPress?.(item.user)}
        onHashtagPress={onHashtagPress}
        onMusicPress={() => onMusicPress?.(item.music)}
      />
    </View>
  );
});

const ReelsFeedScreen = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  const [reels, setReels] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const feedType = route?.params?.type || 'feed'; // 'feed' | 'discover' | 'user'
  const userId = route?.params?.userId;

  // Load token
  const getToken = useCallback(async () => {
    return await AsyncStorage.getItem('token');
  }, []);

  // Fetch reels
  const fetchReels = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      const token = await getToken();
      if (!token) {
        setError('Please login to view reels');
        setIsLoading(false);
        return;
      }

      let endpoint = `${BASE_URL}/api/reels/feed`;
      if (feedType === 'discover') {
        endpoint = `${BASE_URL}/api/reels/discover`;
      } else if (feedType === 'user' && userId) {
        endpoint = `${BASE_URL}/api/reels/user/${userId}`;
      }

      const response = await fetch(`${endpoint}?page=${pageNum}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reels');
      }

      if (refresh || pageNum === 1) {
        setReels(data.reels || []);
      } else {
        setReels(prev => [...prev, ...(data.reels || [])]);
      }

      setHasMore(data.reels?.length === 10);
      setPage(pageNum);
      setError(null);
    } catch (err) {
      console.error('Error fetching reels:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [feedType, userId, getToken]);

  // Initial load
  useEffect(() => {
    fetchReels(1);
  }, [fetchReels]);

  // Pause videos when screen loses focus
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => {
        // Videos auto-pause when isActive becomes false
      };
    }, [])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchReels(1, true);
  }, [fetchReels]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      fetchReels(page + 1);
    }
  }, [isLoadingMore, hasMore, page, fetchReels]);

  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Like reel
  const handleLike = useCallback(async (reelId, liked) => {
    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/reels/${reelId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.error('Error liking reel:', err);
    }
  }, [getToken]);

  // Record view
  const handleView = useCallback(async (reelId) => {
    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/reels/${reelId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ watchDuration: 0, completedWatch: false }),
      });
    } catch (err) {
      console.error('Error recording view:', err);
    }
  }, [getToken]);

  // Navigate to comments
  const handleComment = useCallback((reel) => {
    navigation.navigate('ReelComments', { reelId: reel.id, reel });
  }, [navigation]);

  // Share reel
  const handleShare = useCallback((reel) => {
    // Implement share sheet
  }, []);

  // Navigate to user profile
  const handleUserPress = useCallback((user) => {
    navigation.navigate('UserProfile', { userId: user.id });
  }, [navigation]);

  // Navigate to music page
  const handleMusicPress = useCallback((music) => {
    navigation.navigate('ReelMusic', { musicId: music.id });
  }, [navigation]);

  // Navigate to hashtag page
  const handleHashtagPress = useCallback((hashtag) => {
    navigation.navigate('HashtagReels', { hashtag });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => (
    <ReelItem
      item={item}
      index={index}
      activeIndex={activeIndex}
      isMuted={isMuted}
      onLike={handleLike}
      onComment={handleComment}
      onShare={handleShare}
      onUserPress={handleUserPress}
      onMusicPress={handleMusicPress}
      onHashtagPress={handleHashtagPress}
      onDoubleTapLike={handleLike}
    />
  ), [activeIndex, isMuted, handleLike, handleComment, handleShare, handleUserPress, handleMusicPress, handleHashtagPress]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  const getItemLayout = useCallback((data, index) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  }), []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No reels yet</Text>
        <Text style={styles.emptySubtext}>Be the first to post!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#FF2D55" />
            </View>
          ) : null
        }
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 8,
  },
  loadingMore: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

ReelItem.displayName = 'ReelItem';

export default ReelsFeedScreen;
