/**
 * ReelOverlay Component
 * Action buttons overlay for Reels (like, comment, share, etc.)
 * Super-App Messenger 2026
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const formatCount = (count) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count?.toString() || '0';
};

const ActionButton = memo(({ icon, filledIcon, count, isActive, onPress, color = '#fff' }) => {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.3, { damping: 5 }),
      withSpring(1, { damping: 10 })
    );
    onPress?.();
  }, [onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[styles.actionButton, animatedStyle]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Ionicons
        name={isActive ? filledIcon : icon}
        size={32}
        color={isActive ? '#FF2D55' : color}
      />
      {count !== undefined && (
        <Text style={styles.actionCount}>{formatCount(count)}</Text>
      )}
    </AnimatedTouchable>
  );
});

const MusicDisc = memo(({ coverUrl, isPlaying }) => {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        rotation.value = withTiming(rotation.value + 360, {
          duration: 3000,
        }, () => {
          if (isPlaying) animate();
        });
      };
      animate();
    }
  }, [isPlaying]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.musicDisc, animatedStyle]}>
      <LinearGradient
        colors={['#0B0F19', '#333']}
        style={styles.discOuter}
      >
        <Image
          source={{ uri: coverUrl || 'https://via.placeholder.com/40' }}
          style={styles.discCover}
        />
      </LinearGradient>
    </Animated.View>
  );
});

const ReelOverlay = memo(({
  reel,
  isLiked = false,
  isSaved = false,
  isPlaying = true,
  onLike,
  onComment,
  onShare,
  onSave,
  onUserPress,
  onMusicPress,
  onMorePress,
}) => {
  const {
    user,
    likesCount = 0,
    commentsCount = 0,
    sharesCount = 0,
    music,
  } = reel || {};

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Right Side Actions */}
      <View style={styles.actionsContainer}>
        {/* User Avatar */}
        <Pressable style={styles.avatarContainer} onPress={onUserPress}>
          <Image
            source={{ uri: user?.avatar || 'https://via.placeholder.com/48' }}
            style={styles.avatar}
          />
          <View style={styles.followBadge}>
            <Ionicons name="add" size={12} color="#fff" />
          </View>
        </Pressable>

        {/* Like */}
        <ActionButton
          icon="heart-outline"
          filledIcon="heart"
          count={likesCount}
          isActive={isLiked}
          onPress={onLike}
        />

        {/* Comment */}
        <ActionButton
          icon="chatbubble-ellipses-outline"
          filledIcon="chatbubble-ellipses"
          count={commentsCount}
          onPress={onComment}
        />

        {/* Share */}
        <ActionButton
          icon="paper-plane-outline"
          filledIcon="paper-plane"
          count={sharesCount}
          onPress={onShare}
        />

        {/* Save */}
        <ActionButton
          icon="bookmark-outline"
          filledIcon="bookmark"
          isActive={isSaved}
          onPress={onSave}
        />

        {/* More */}
        <TouchableOpacity style={styles.actionButton} onPress={onMorePress}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Music Disc */}
        {music && (
          <TouchableOpacity onPress={onMusicPress} style={styles.musicDiscContainer}>
            <MusicDisc coverUrl={music.thumbnailUrl} isPlaying={isPlaying} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 100,
    paddingRight: 12,
  },
  actionsContainer: {
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  followBadge: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  musicDiscContainer: {
    marginTop: 8,
  },
  musicDisc: {
    width: 48,
    height: 48,
  },
  discOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#444',
  },
  discCover: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
});

ReelOverlay.displayName = 'ReelOverlay';
ActionButton.displayName = 'ActionButton';
MusicDisc.displayName = 'MusicDisc';

export default ReelOverlay;
