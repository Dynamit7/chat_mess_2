/**
 * ReactionPicker Component
 * Enhanced emoji reaction picker with categories and animations
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  ZoomIn,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../ThemeContext';
import { glassPresets } from '../../design-system/tokens/glass';

interface ReactionPickerProps {
  visible: boolean;
  position: { x: number; y: number };
  onSelect: (emoji: string) => void;
  onClose: () => void;
  selectedEmojis?: string[];
}

// Quick reactions (always visible)
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

// Extended reaction categories
const REACTION_CATEGORIES = {
  frequent: {
    label: 'Frequently Used',
    emojis: ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👏', '💯', '🙏', '😍'],
  },
  love: {
    label: 'Love',
    emojis: ['❤️', '💕', '💖', '💗', '💓', '💘', '💝', '😍', '🥰', '😘', '💋', '💌'],
  },
  happy: {
    label: 'Happy',
    emojis: ['😊', '😄', '😁', '🥰', '😇', '🤗', '😎', '🤩', '🥳', '😋', '🤤', '😌'],
  },
  sad: {
    label: 'Sad',
    emojis: ['😢', '😭', '😞', '😔', '🥺', '😿', '💔', '😩', '😫', '😥', '😓', '🙁'],
  },
  angry: {
    label: 'Angry',
    emojis: ['😠', '😡', '🤬', '💢', '👿', '😤', '🔥', '💥', '☠️', '👊', '🖕', '😾'],
  },
  celebration: {
    label: 'Celebration',
    emojis: ['🎉', '🎊', '🥳', '🎈', '🎁', '🏆', '🥇', '✨', '🌟', '💫', '🎇', '🎆'],
  },
  gestures: {
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤟', '🤘', '👌', '🤙', '💪'],
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  visible,
  position,
  onSelect,
  onClose,
  selectedEmojis = [],
}) => {
  const { theme, isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState('frequent');

  const scaleY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const expandedHeight = useSharedValue(0);

  const glassConfig = isDarkMode ? glassPresets.tooltipDark : glassPresets.tooltipLight;

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 150 });
      scaleY.value = withSpring(1, { damping: 15, stiffness: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 100 });
      scaleY.value = withTiming(0, { duration: 150 });
      setIsExpanded(false);
    }
  }, [visible]);

  useEffect(() => {
    expandedHeight.value = withSpring(isExpanded ? 280 : 0, { damping: 15, stiffness: 200 });
  }, [isExpanded]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleY: scaleY.value }],
    transformOrigin: 'bottom',
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    height: expandedHeight.value,
    opacity: expandedHeight.value > 50 ? 1 : 0,
  }));

  const handleSelectEmoji = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(emoji);
  };

  const handleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  const handleCategoryChange = (category: string) => {
    Haptics.selectionAsync();
    setActiveCategory(category);
  };

  if (!visible) return null;

  // Calculate position to keep picker on screen
  const adjustedX = Math.max(8, Math.min(position.x - 120, SCREEN_WIDTH - 248));
  const adjustedY = position.y - 60;

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        { top: adjustedY, left: adjustedX },
      ]}
    >
      <BlurView
        intensity={glassConfig.blur}
        tint={isDarkMode ? 'dark' : 'light'}
        style={[
          styles.picker,
          {
            backgroundColor: glassConfig.backgroundColor,
            borderColor: glassConfig.borderColor,
            borderWidth: glassConfig.borderWidth,
            borderRadius: glassConfig.borderRadius,
          },
        ]}
      >
        {/* Quick Reactions */}
        <View style={styles.quickReactions}>
          {QUICK_REACTIONS.map((emoji, index) => {
            const isSelected = selectedEmojis.includes(emoji);
            return (
              <Animated.View
                key={emoji}
                entering={ZoomIn.delay(index * 30).springify()}
              >
                <Pressable
                  onPress={() => handleSelectEmoji(emoji)}
                  style={({ pressed }) => [
                    styles.emojiButton,
                    pressed && styles.emojiButtonPressed,
                    isSelected && [styles.emojiButtonSelected, { borderColor: theme.colors.brand.primary }],
                  ]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              </Animated.View>
            );
          })}

          {/* Expand Button */}
          <Pressable onPress={handleExpand} style={styles.expandButton}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'add'}
              size={20}
              color={theme.colors.text.secondary}
            />
          </Pressable>
        </View>

        {/* Expanded View */}
        <Animated.View style={[styles.expandedContainer, expandedStyle]}>
          {/* Category Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabs}>
            {Object.keys(REACTION_CATEGORIES).map((category) => (
              <Pressable
                key={category}
                onPress={() => handleCategoryChange(category)}
                style={[
                  styles.categoryTab,
                  activeCategory === category && [
                    styles.categoryTabActive,
                    { backgroundColor: theme.colors.brand.primary },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    { color: activeCategory === category ? '#FFF' : theme.colors.text.secondary },
                  ]}
                >
                  {REACTION_CATEGORIES[category as keyof typeof REACTION_CATEGORIES].emojis[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Emoji Grid */}
          <View style={styles.emojiGrid}>
            {REACTION_CATEGORIES[activeCategory as keyof typeof REACTION_CATEGORIES].emojis.map((emoji, index) => {
              const isSelected = selectedEmojis.includes(emoji);
              return (
                <Animated.View
                  key={emoji}
                  entering={FadeIn.delay(index * 20)}
                >
                  <Pressable
                    onPress={() => handleSelectEmoji(emoji)}
                    style={({ pressed }) => [
                      styles.gridEmojiButton,
                      pressed && styles.emojiButtonPressed,
                      isSelected && [styles.emojiButtonSelected, { borderColor: theme.colors.brand.primary }],
                    ]}
                  >
                    <Text style={styles.gridEmoji}>{emoji}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      </BlurView>

      {/* Close overlay */}
      <Pressable style={styles.closeOverlay} onPress={onClose} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  picker: {
    overflow: 'hidden',
    minWidth: 240,
  },
  quickReactions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emojiButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  emojiButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    transform: [{ scale: 1.1 }],
  },
  emojiButtonSelected: {
    borderWidth: 2,
    backgroundColor: 'rgba(124, 92, 255, 0.1)',
  },
  emoji: {
    fontSize: 24,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  expandedContainer: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  categoryTab: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  categoryTabActive: {
    transform: [{ scale: 1.1 }],
  },
  categoryTabText: {
    fontSize: 18,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  gridEmojiButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  gridEmoji: {
    fontSize: 24,
  },
  closeOverlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: -1,
  },
});

export default ReactionPicker;
