/**
 * SmartReplyBar Component
 * AI-powered smart reply suggestions above keyboard
 * Super-App Messenger 2026
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../src/config';

const SuggestionChip = memo(({ text, onPress, index }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    onPress(text);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(index * 50).duration(200)}
      style={animatedStyle}
    >
      <TouchableOpacity style={styles.chip} onPress={handlePress}>
        <Text style={styles.chipText} numberOfLines={2}>
          {text}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SmartReplyBar = ({
  visible = false,
  conversationContext = '',
  onSuggestionSelect,
  language = 'en',
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEnabled, setIsEnabled] = useState(true);

  const getToken = useCallback(async () => {
    return await AsyncStorage.getItem('token');
  }, []);

  // Fetch smart reply suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!conversationContext || !visible || !isEnabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/ai/smart-reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: conversationContext,
          count: 3,
          language,
        }),
      });

      const data = await response.json();

      if (response.ok && data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Error fetching smart replies:', err);
      setError('Failed to load suggestions');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationContext, visible, isEnabled, language, getToken]);

  // Fetch suggestions when context changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (visible && conversationContext) {
        fetchSuggestions();
      }
    }, 500); // Debounce to avoid too many API calls

    return () => clearTimeout(debounceTimer);
  }, [fetchSuggestions, visible, conversationContext]);

  // Handle suggestion selection
  const handleSuggestionPress = useCallback((text) => {
    onSuggestionSelect?.(text);
  }, [onSuggestionSelect]);

  // Toggle smart replies
  const toggleEnabled = useCallback(async () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    await AsyncStorage.setItem('smartRepliesEnabled', JSON.stringify(newState));

    if (newState && conversationContext) {
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [isEnabled, conversationContext, fetchSuggestions]);

  // Load enabled state
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('smartRepliesEnabled');
      if (stored !== null) {
        setIsEnabled(JSON.parse(stored));
      }
    })();
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInDown.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      <BlurView intensity={60} tint="dark" style={styles.blurContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#FF2D55', '#7C5CFF']}
              style={styles.iconGradient}
            >
              <Ionicons name="sparkles" size={12} color="#fff" />
            </LinearGradient>
            <Text style={styles.headerText}>Smart Replies</Text>
          </View>
          <TouchableOpacity style={styles.toggleButton} onPress={toggleEnabled}>
            <Ionicons
              name={isEnabled ? 'eye' : 'eye-off'}
              size={18}
              color={isEnabled ? '#FF2D55' : 'rgba(255,255,255,0.3)'}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isEnabled && (
          <View style={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FF2D55" />
                <Text style={styles.loadingText}>Generating suggestions...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchSuggestions}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : suggestions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsContainer}
              >
                {suggestions.map((suggestion, index) => (
                  <SuggestionChip
                    key={index}
                    text={suggestion}
                    onPress={handleSuggestionPress}
                    index={index}
                  />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>
                Type a message to get suggestions
              </Text>
            )}
          </View>
        )}
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 4,
  },
  blurContainer: {
    borderRadius: 16,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconGradient: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  toggleButton: {
    padding: 4,
  },
  content: {
    paddingBottom: 10,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,45,85,0.2)',
    borderRadius: 8,
  },
  retryText: {
    color: '#FF2D55',
    fontSize: 12,
    fontWeight: '500',
  },
  suggestionsContainer: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: 200,
    marginRight: 8,
  },
  chipText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
});

SuggestionChip.displayName = 'SuggestionChip';

export default SmartReplyBar;
