/**
 * StickerPicker Component
 * Sticker and GIF picker with categories and search
 * Super-App Messenger 2026
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../src/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STICKER_SIZE = (SCREEN_WIDTH - 64) / 4;
const GIF_WIDTH = (SCREEN_WIDTH - 48) / 2;

const TABS = [
  { id: 'recent', icon: 'time-outline', label: 'Recent' },
  { id: 'stickers', icon: 'happy-outline', label: 'Stickers' },
  { id: 'gifs', icon: 'film-outline', label: 'GIFs' },
];

const StickerItem = memo(({ sticker, onSelect }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.8, {}, () => {
      scale.value = withSpring(1);
    });
    onSelect(sticker);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity style={styles.stickerItem} onPress={handlePress}>
        <Image
          source={{ uri: sticker.imageUrl }}
          style={styles.stickerImage}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </Animated.View>
  );
});

const GifItem = memo(({ gif, onSelect }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <TouchableOpacity style={styles.gifItem} onPress={() => onSelect(gif)}>
      {!loaded && (
        <View style={styles.gifPlaceholder}>
          <ActivityIndicator size="small" color="#FF2D55" />
        </View>
      )}
      <Image
        source={{ uri: gif.preview || gif.url }}
        style={[styles.gifImage, { aspectRatio: gif.width / gif.height }]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
    </TouchableOpacity>
  );
});

const PackTab = memo(({ pack, isSelected, onSelect }) => (
  <TouchableOpacity
    style={[styles.packTab, isSelected && styles.packTabSelected]}
    onPress={() => onSelect(pack)}
  >
    <Image
      source={{ uri: pack.thumbnailUrl }}
      style={styles.packTabImage}
      resizeMode="contain"
    />
  </TouchableOpacity>
));

const StickerPicker = ({ onStickerSelect, onGifSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState('stickers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [stickers, setStickers] = useState([]);
  const [gifs, setGifs] = useState([]);
  const [stickerPacks, setStickerPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);
  const [recentStickers, setRecentStickers] = useState([]);

  const getToken = useCallback(async () => {
    return await AsyncStorage.getItem('token');
  }, []);

  // Fetch sticker packs
  const fetchStickerPacks = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/stickers/my-packs`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      setStickerPacks(data.packs || []);
      if (data.packs?.length > 0) {
        setSelectedPack(data.packs[0]);
        setStickers(data.packs[0].stickers || []);
      }
    } catch (error) {
      console.error('Error fetching sticker packs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Fetch recent stickers
  const fetchRecentStickers = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/stickers/recent`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      setRecentStickers(data.stickers || []);
    } catch (error) {
      console.error('Error fetching recent stickers:', error);
    }
  }, [getToken]);

  // Fetch GIFs
  const fetchGifs = useCallback(async (query = '') => {
    try {
      const token = await getToken();
      const endpoint = query
        ? `${BASE_URL}/api/stickers/giphy?q=${encodeURIComponent(query)}`
        : `${BASE_URL}/api/stickers/giphy`;

      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      setGifs(data.gifs || []);
    } catch (error) {
      console.error('Error fetching GIFs:', error);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStickerPacks();
    fetchRecentStickers();
    fetchGifs();
  }, [fetchStickerPacks, fetchRecentStickers, fetchGifs]);

  // Handle pack selection
  const handlePackSelect = useCallback(async (pack) => {
    setSelectedPack(pack);

    if (pack.stickers) {
      setStickers(pack.stickers);
    } else {
      // Fetch full pack details
      try {
        const token = await getToken();
        const response = await fetch(`${BASE_URL}/api/stickers/packs/${pack.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        setStickers(data.pack?.stickers || []);
      } catch (error) {
        console.error('Error fetching pack stickers:', error);
      }
    }
  }, [getToken]);

  // Handle sticker selection
  const handleStickerSelect = useCallback(async (sticker) => {
    // Mark as used
    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/stickers/use/${sticker.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Error marking sticker as used:', error);
    }

    onStickerSelect?.(sticker);
  }, [getToken, onStickerSelect]);

  // Handle GIF selection
  const handleGifSelect = useCallback((gif) => {
    onGifSelect?.(gif);
  }, [onGifSelect]);

  // Handle search
  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    if (activeTab === 'gifs') {
      fetchGifs(text);
    }
  }, [activeTab, fetchGifs]);

  const renderSticker = useCallback(({ item }) => (
    <StickerItem sticker={item} onSelect={handleStickerSelect} />
  ), [handleStickerSelect]);

  const renderGif = useCallback(({ item }) => (
    <GifItem gif={item} onSelect={handleGifSelect} />
  ), [handleGifSelect]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF2D55" />
        </View>
      );
    }

    switch (activeTab) {
      case 'recent':
        return (
          <FlatList
            data={recentStickers}
            renderItem={renderSticker}
            keyExtractor={item => item.id.toString()}
            numColumns={4}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyText}>No recent stickers</Text>
              </View>
            }
          />
        );

      case 'stickers':
        return (
          <View style={styles.stickersContainer}>
            {/* Pack tabs */}
            <FlatList
              horizontal
              data={stickerPacks}
              renderItem={({ item }) => (
                <PackTab
                  pack={item}
                  isSelected={selectedPack?.id === item.id}
                  onSelect={handlePackSelect}
                />
              )}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.packTabs}
              showsHorizontalScrollIndicator={false}
            />

            {/* Stickers grid */}
            <FlatList
              data={stickers}
              renderItem={renderSticker}
              keyExtractor={item => item.id.toString()}
              numColumns={4}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="happy-outline" size={48} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.emptyText}>No stickers in this pack</Text>
                </View>
              }
            />
          </View>
        );

      case 'gifs':
        return (
          <FlatList
            data={gifs}
            renderItem={renderGif}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={styles.gifsContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="film-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyText}>No GIFs found</Text>
              </View>
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={styles.searchInput}
              placeholder={activeTab === 'gifs' ? 'Search GIFs...' : 'Search stickers...'}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={activeTab === tab.id ? '#FF2D55' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderContent()}
        </View>
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 400,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginLeft: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(255,45,85,0.2)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FF2D55',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 12,
  },
  stickersContainer: {
    flex: 1,
  },
  packTabs: {
    paddingHorizontal: 12,
    gap: 8,
  },
  packTab: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  packTabSelected: {
    backgroundColor: 'rgba(255,45,85,0.3)',
    borderWidth: 2,
    borderColor: '#FF2D55',
  },
  packTabImage: {
    width: 32,
    height: 32,
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  stickerItem: {
    width: STICKER_SIZE,
    height: STICKER_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerImage: {
    width: STICKER_SIZE - 8,
    height: STICKER_SIZE - 8,
  },
  gifsContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  gifItem: {
    width: GIF_WIDTH,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gifPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifImage: {
    width: '100%',
    minHeight: 80,
  },
});

StickerItem.displayName = 'StickerItem';
GifItem.displayName = 'GifItem';
PackTab.displayName = 'PackTab';

export default StickerPicker;
