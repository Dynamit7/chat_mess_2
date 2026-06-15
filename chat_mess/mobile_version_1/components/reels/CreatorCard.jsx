/**
 * CreatorCard Component
 * User profile card for Reels creators
 * Super-App Messenger 2026
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const formatCount = (count) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count?.toString() || '0';
};

const StatItem = memo(({ label, value }) => (
  <View style={styles.statItem}>
    <Text style={styles.statValue}>{formatCount(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

const CreatorCard = memo(({
  user,
  isFollowing = false,
  onFollow,
  onProfilePress,
  onMessagePress,
  style,
  variant = 'full', // 'full' | 'compact' | 'mini'
}) => {
  const followScale = useSharedValue(1);

  const {
    id,
    username,
    displayName,
    avatar,
    bio,
    isVerified,
    followersCount = 0,
    followingCount = 0,
    reelsCount = 0,
    likesCount = 0,
  } = user || {};

  const handleFollow = useCallback(() => {
    followScale.value = withSpring(0.9, { damping: 10 }, () => {
      followScale.value = withSpring(1, { damping: 15 });
    });
    onFollow?.(id);
  }, [id, onFollow]);

  const followButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: followScale.value }],
  }));

  if (variant === 'mini') {
    return (
      <Pressable
        style={[styles.miniContainer, style]}
        onPress={() => onProfilePress?.(id)}
      >
        <Image
          source={{ uri: avatar || 'https://via.placeholder.com/40' }}
          style={styles.miniAvatar}
        />
        <Text style={styles.miniUsername} numberOfLines={1}>
          @{username}
        </Text>
      </Pressable>
    );
  }

  if (variant === 'compact') {
    return (
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[styles.compactContainer, style]}
      >
        <BlurView intensity={80} tint="dark" style={styles.compactBlur}>
          <Pressable
            style={styles.compactContent}
            onPress={() => onProfilePress?.(id)}
          >
            <Image
              source={{ uri: avatar || 'https://via.placeholder.com/48' }}
              style={styles.compactAvatar}
            />
            <View style={styles.compactInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.compactName} numberOfLines={1}>
                  {displayName || username}
                </Text>
                {isVerified && (
                  <Ionicons name="checkmark-circle" size={14} color="#00A3FF" />
                )}
              </View>
              <Text style={styles.compactUsername}>@{username}</Text>
            </View>
            <Animated.View style={followButtonStyle}>
              <TouchableOpacity
                style={[
                  styles.compactFollowButton,
                  isFollowing && styles.followingButton,
                ]}
                onPress={handleFollow}
              >
                <Text
                  style={[
                    styles.compactFollowText,
                    isFollowing && styles.followingText,
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </BlurView>
      </Animated.View>
    );
  }

  // Full variant
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.container, style]}
    >
      <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
        {/* Header with avatar */}
        <Pressable
          style={styles.header}
          onPress={() => onProfilePress?.(id)}
        >
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#FF2D55', '#FF6B6B', '#FFD93D']}
              style={styles.avatarGradient}
            >
              <Image
                source={{ uri: avatar || 'https://via.placeholder.com/80' }}
                style={styles.avatar}
              />
            </LinearGradient>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {displayName || username}
              </Text>
              {isVerified && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#00A3FF"
                  style={styles.verifiedIcon}
                />
              )}
            </View>
            <Text style={styles.username}>@{username}</Text>
          </View>
        </Pressable>

        {/* Bio */}
        {bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {bio}
          </Text>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <StatItem label="Followers" value={followersCount} />
          <StatItem label="Following" value={followingCount} />
          <StatItem label="Reels" value={reelsCount} />
          <StatItem label="Likes" value={likesCount} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Animated.View style={[styles.followButtonWrapper, followButtonStyle]}>
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followingButton,
              ]}
              onPress={handleFollow}
            >
              <Text
                style={[
                  styles.followButtonText,
                  isFollowing && styles.followingText,
                ]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => onMessagePress?.(id)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </BlurView>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  // Full variant styles
  container: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurContainer: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarGradient: {
    width: 84,
    height: 84,
    borderRadius: 42,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: '#000',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  username: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 2,
  },
  bio: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  followButtonWrapper: {
    flex: 1,
  },
  followButton: {
    backgroundColor: '#FF2D55',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  followingText: {
    color: 'rgba(255,255,255,0.8)',
  },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Compact variant styles
  compactContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  compactBlur: {
    padding: 12,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  compactUsername: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  compactFollowButton: {
    backgroundColor: '#FF2D55',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  compactFollowText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Mini variant styles
  miniContainer: {
    alignItems: 'center',
    width: 70,
  },
  miniAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#FF2D55',
  },
  miniUsername: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
});

CreatorCard.displayName = 'CreatorCard';
StatItem.displayName = 'StatItem';

export default CreatorCard;
