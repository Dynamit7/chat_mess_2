/**
 * ReactionBubble Component
 * Displays message reactions with counts and user info
 */

import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  ZoomIn,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../ThemeContext';

interface ReactionData {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface ReactionBubbleProps {
  reactions: ReactionData[];
  onReactionPress: (emoji: string, hasReacted: boolean) => void;
  onLongPress?: (emoji: string) => void;
  maxVisible?: number;
  isSent?: boolean;
}

export const ReactionBubble: React.FC<ReactionBubbleProps> = ({
  reactions,
  onReactionPress,
  onLongPress,
  maxVisible = 5,
  isSent = false,
}) => {
  const { theme, isDarkMode } = useTheme();

  if (!reactions || reactions.length === 0) return null;

  const visibleReactions = reactions.slice(0, maxVisible);
  const hiddenCount = reactions.length - maxVisible;
  const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <View style={[styles.container, isSent && styles.containerSent]}>
      <BlurView
        intensity={25}
        tint={isDarkMode ? 'dark' : 'light'}
        style={[
          styles.bubble,
          {
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          },
        ]}
      >
        {visibleReactions.map((reaction, index) => (
          <ReactionItem
            key={reaction.emoji}
            reaction={reaction}
            index={index}
            onPress={() => onReactionPress(reaction.emoji, reaction.hasReacted)}
            onLongPress={() => onLongPress?.(reaction.emoji)}
            theme={theme}
          />
        ))}

        {hiddenCount > 0 && (
          <View style={styles.moreCount}>
            <Text style={[styles.moreCountText, { color: theme.colors.text.secondary }]}>
              +{hiddenCount}
            </Text>
          </View>
        )}
      </BlurView>
    </View>
  );
};

interface ReactionItemProps {
  reaction: ReactionData;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
  theme: any;
}

const ReactionItem: React.FC<ReactionItemProps> = ({
  reaction,
  index,
  onPress,
  onLongPress,
  theme,
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const handlePress = () => {
    // Pop animation
    scale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 500 }),
      withSpring(1, { damping: 12, stiffness: 300 })
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={ZoomIn.delay(index * 50).springify()}
      style={animatedStyle}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={[
          styles.reactionItem,
          reaction.hasReacted && [
            styles.reactionItemActive,
            { backgroundColor: `${theme.colors.brand.primary}20` },
          ],
        ]}
      >
        <Text style={styles.emoji}>{reaction.emoji}</Text>
        {reaction.count > 1 && (
          <Text
            style={[
              styles.count,
              {
                color: reaction.hasReacted
                  ? theme.colors.brand.primary
                  : theme.colors.text.secondary,
              },
            ]}
          >
            {reaction.count}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    marginTop: -8,
    marginLeft: 8,
    zIndex: 10,
  },
  containerSent: {
    alignSelf: 'flex-end',
    marginRight: 8,
    marginLeft: 0,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 12,
  },
  reactionItemActive: {
    borderRadius: 12,
  },
  emoji: {
    fontSize: 16,
  },
  count: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  moreCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moreCountText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default ReactionBubble;
