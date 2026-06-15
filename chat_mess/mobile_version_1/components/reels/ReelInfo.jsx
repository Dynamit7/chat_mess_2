/**
 * ReelInfo Component
 * Caption, hashtags, and music info for Reels
 * Super-App Messenger 2026
 */

import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_CAPTION_LENGTH = 100;

const Hashtag = memo(({ tag, onPress }) => (
  <TouchableOpacity onPress={() => onPress?.(tag)}>
    <Text style={styles.hashtag}>#{tag}</Text>
  </TouchableOpacity>
));

const MarqueeText = memo(({ text, style }) => {
  // Simplified marquee - just showing text with ellipsis for now
  // Full implementation would use Animated translateX
  return (
    <Text style={style} numberOfLines={1}>
      {text}
    </Text>
  );
});

const ReelInfo = memo(({
  reel,
  onUserPress,
  onHashtagPress,
  onMusicPress,
  onCaptionExpand,
}) => {
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const expandHeight = useSharedValue(0);

  const {
    user,
    caption = '',
    hashtags = [],
    music,
    createdAt,
  } = reel || {};

  const shouldTruncate = caption.length > MAX_CAPTION_LENGTH;
  const displayCaption = isExpanded ? caption : caption.slice(0, MAX_CAPTION_LENGTH);

  const toggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
    expandHeight.value = withTiming(isExpanded ? 0 : 1, { duration: 200 });
    onCaptionExpand?.(!isExpanded);
  }, [isExpanded, onCaptionExpand]);

  const expandedStyle = useAnimatedStyle(() => ({
    maxHeight: expandHeight.value === 0 ? 80 : 300,
  }));

  const timeAgo = useCallback((date) => {
    if (!date) return '';
    const now = new Date();
    const posted = new Date(date);
    const diffMs = now - posted;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return posted.toLocaleDateString();
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 80 }]}>
      {/* User Info */}
      <Pressable style={styles.userContainer} onPress={onUserPress}>
        <Text style={styles.username}>@{user?.username || 'user'}</Text>
        {user?.isVerified && (
          <Ionicons name="checkmark-circle" size={14} color="#00A3FF" style={styles.verifiedBadge} />
        )}
        <Text style={styles.timeAgo}> · {timeAgo(createdAt)}</Text>
      </Pressable>

      {/* Caption */}
      {caption && (
        <Animated.View style={[styles.captionContainer, expandedStyle]}>
          <Text style={styles.caption}>
            {displayCaption}
            {shouldTruncate && !isExpanded && '...'}
          </Text>
          {shouldTruncate && (
            <TouchableOpacity onPress={toggleExpand}>
              <Text style={styles.expandButton}>
                {isExpanded ? 'less' : 'more'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <Animated.View
          entering={FadeIn.delay(100)}
          style={styles.hashtagsContainer}
        >
          {hashtags.slice(0, 5).map((tag, index) => (
            <Hashtag key={index} tag={tag} onPress={onHashtagPress} />
          ))}
          {hashtags.length > 5 && (
            <Text style={styles.moreHashtags}>+{hashtags.length - 5}</Text>
          )}
        </Animated.View>
      )}

      {/* Music Info */}
      {music && (
        <Animated.View entering={FadeIn.delay(200)}>
          <TouchableOpacity
            style={styles.musicContainer}
            onPress={onMusicPress}
          >
            <Ionicons name="musical-notes" size={14} color="#fff" />
            <MarqueeText
              text={`${music.title} - ${music.artist}`}
              style={styles.musicText}
            />
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  timeAgo: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '400',
  },
  captionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    marginBottom: 8,
    overflow: 'hidden',
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  expandButton: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 8,
  },
  hashtag: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  moreHashtags: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  musicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  musicText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginHorizontal: 8,
    flex: 1,
  },
});

ReelInfo.displayName = 'ReelInfo';
Hashtag.displayName = 'Hashtag';
MarqueeText.displayName = 'MarqueeText';

export default ReelInfo;
