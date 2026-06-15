/**
 * DiscoverScreen
 * Trending content and hashtag exploration for Reels
 * Super-App Messenger 2026
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../src/config';
import CreatorCard from '../../components/reels/CreatorCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = (SCREEN_WIDTH - 48) / 3;

const formatCount = (count) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count?.toString() || '0';
};

const TrendingHashtag = ({ hashtag, index, onPress }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    onPress?.(hashtag);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={animatedStyle}
    >
      <TouchableOpacity style={styles.hashtagItem} onPress={handlePress}>
        <LinearGradient
          colors={['#FF2D55', '#FF6B6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hashtagRank}
        >
          <Text style={styles.hashtagRankText}>{index + 1}</Text>
        </LinearGradient>
        <View style={styles.hashtagInfo}>
          <Text style={styles.hashtagName}>#{hashtag.name}</Text>
          <Text style={styles.hashtagViews}>{formatCount(hashtag.viewsCount)} views</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const ReelThumbnail = ({ reel, index, onPress }) => {
  return (
    <Animated.View entering={FadeIn.delay(index * 30)}>
      <TouchableOpacity
        style={styles.thumbnail}
        onPress={() => onPress?.(reel)}
      >
        <Image
          source={{ uri: reel.thumbnailUrl }}
          style={styles.thumbnailImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.thumbnailGradient}
        >
          <View style={styles.thumbnailStats}>
            <Ionicons name="play" size={12} color="#fff" />
            <Text style={styles.thumbnailViews}>{formatCount(reel.viewsCount)}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DiscoverScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [trendingReels, setTrendingReels] = useState([]);
  const [suggestedCreators, setSuggestedCreators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getToken = useCallback(async () => {
    return await AsyncStorage.getItem('token');
  }, []);

  const fetchDiscoverData = useCallback(async () => {
    try {
      const token = await getToken();

      // Fetch trending hashtags
      const hashtagsRes = await fetch(`${BASE_URL}/api/reels/hashtags/trending`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const hashtagsData = await hashtagsRes.json();
      setTrendingHashtags(hashtagsData.hashtags || []);

      // Fetch trending reels
      const reelsRes = await fetch(`${BASE_URL}/api/reels/discover?limit=9`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const reelsData = await reelsRes.json();
      setTrendingReels(reelsData.reels || []);

      // Suggested creators would come from a separate endpoint
      // setSuggestedCreators(...)
    } catch (err) {
      console.error('Error fetching discover data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchDiscoverData();
  }, [fetchDiscoverData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchDiscoverData();
  }, [fetchDiscoverData]);

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      navigation.navigate('SearchResults', { query: searchQuery });
    }
  }, [searchQuery, navigation]);

  const handleHashtagPress = useCallback((hashtag) => {
    navigation.navigate('HashtagReels', { hashtag: hashtag.name });
  }, [navigation]);

  const handleReelPress = useCallback((reel) => {
    navigation.navigate('ReelsFeed', { initialReelId: reel.id, type: 'discover' });
  }, [navigation]);

  const handleCreatorPress = useCallback((userId) => {
    navigation.navigate('UserProfile', { userId });
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#FF2D55" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <BlurView intensity={30} tint="dark" style={styles.searchBlur}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search creators, hashtags..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </BlurView>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FF2D55"
          />
        }
      >
        {/* Trending Hashtags */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Hashtags</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          {trendingHashtags.slice(0, 5).map((hashtag, index) => (
            <TrendingHashtag
              key={hashtag.id || index}
              hashtag={hashtag}
              index={index}
              onPress={handleHashtagPress}
            />
          ))}
        </View>

        {/* Trending Reels */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Now</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ReelsFeed', { type: 'discover' })}
            >
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.reelsGrid}>
            {trendingReels.map((reel, index) => (
              <ReelThumbnail
                key={reel.id}
                reel={reel}
                index={index}
                onPress={handleReelPress}
              />
            ))}
          </View>
        </View>

        {/* Suggested Creators */}
        {suggestedCreators.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Creators to Follow</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.creatorsScroll}
            >
              {suggestedCreators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  user={creator}
                  variant="mini"
                  onProfilePress={handleCreatorPress}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse by Category</Text>
          <View style={styles.categoriesGrid}>
            {['Comedy', 'Music', 'Dance', 'Food', 'Travel', 'Sports', 'Gaming', 'Fashion'].map((category, index) => (
              <TouchableOpacity
                key={category}
                style={styles.categoryCard}
                onPress={() => navigation.navigate('CategoryReels', { category })}
              >
                <LinearGradient
                  colors={[
                    ['#FF2D55', '#FF6B6B'],
                    ['#5856D6', '#7C5CFF'],
                    ['#00C7BE', '#34C759'],
                    ['#FF9500', '#FFCC00'],
                  ][index % 4]}
                  style={styles.categoryGradient}
                >
                  <Text style={styles.categoryText}>{category}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginLeft: 10,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  seeAllText: {
    color: '#FF2D55',
    fontSize: 14,
    fontWeight: '600',
  },
  hashtagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  hashtagRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hashtagRankText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  hashtagInfo: {
    flex: 1,
  },
  hashtagName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hashtagViews: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  reelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE * 1.5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  thumbnailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  thumbnailViews: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  creatorsScroll: {
    paddingRight: 16,
    gap: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  categoryCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DiscoverScreen;
