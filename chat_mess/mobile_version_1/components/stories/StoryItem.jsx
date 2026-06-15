import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../ThemeContext";
import { useNavigation } from "@react-navigation/native";
import Icon from '@expo/vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';
import { BASE_URL } from "../../src/config";

export default function StoryItem({ userId, picture, username, stories = [], currentUserId, onStoryDeleted, isViewed }) {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const hasStories = stories.length > 0;
  const isOwnStory = Number(userId) === Number(currentUserId);
  const storyCount = stories.length;

  const ringColors = isViewed
    ? ['#aaa', '#888']
    : hasStories
      ? ['#7C5CFF', '#9070FF', '#FF6B9D']
      : ['#ddd', '#ccc'];

  const badgeColors = isViewed ? ['#aaa', '#888'] : ['#7C5CFF', '#9070FF'];

  const handleDelete = async (storyId) => {
    try {
      const response = await fetch(`${BASE_URL}/api/stories/${storyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (!response.ok) throw new Error('Failed to delete story');
      onStoryDeleted();
    } catch (error) {
      console.error('Error deleting story:', error);
    }
  };

  const renderAvatar = () => (
    picture ? (
      <Image style={styles.avatar} source={{ uri: picture }} onError={err => console.log("Avatar error", err)} />
    ) : (
      <LinearGradient colors={['#7C5CFF', '#9070FF']} style={styles.avatarPlaceholder}>
        <Text style={styles.avatarLetter}>{username?.charAt(0)?.toUpperCase()}</Text>
      </LinearGradient>
    )
  );

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDarkMode ? '#1a1530' : '#fff',
          shadowColor: isDarkMode ? '#7C5CFF' : '#ccc',
        },
      ]}
      activeOpacity={0.8}
      onPress={() => hasStories && navigation.navigate("StoryPreview", { stories, username, storyOwnerId: userId, currentUserId })}
    >
      <View style={styles.avatarSection}>
        {/* Gradient ring */}
        <LinearGradient
          colors={ringColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientRing}
        >
          <View style={[styles.avatarInner, { backgroundColor: isDarkMode ? '#1a1530' : '#fff' }]}>
            {renderAvatar()}
          </View>
        </LinearGradient>

        {/* Story count badge */}
        {storyCount > 0 && !isViewed && (
          <LinearGradient
            colors={badgeColors}
            style={styles.countBadge}
          >
            <Text style={styles.countText}>{storyCount}</Text>
          </LinearGradient>
        )}
      </View>

      <View style={styles.textSection}>
        <Text numberOfLines={1} style={[styles.username, { color: isDarkMode ? '#fff' : '#121826' }]}>
          {username}
        </Text>
        <Text numberOfLines={1} style={[styles.storyInfo, { color: isDarkMode ? '#AD94FF' : '#999' }]}>
          {storyCount} {storyCount === 1 ? 'story' : 'stories'}
        </Text>
      </View>

      {isOwnStory && hasStories ? (
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: isDarkMode ? '#2a1f3d' : '#FEF2F2' }]}
          onPress={() => handleDelete(stories[0].id)}
        >
          <Icon name="trash" size={14} color="#EF4444" />
        </TouchableOpacity>
      ) : (
        <View style={styles.arrowSection}>
          <Icon name="chevron-right" size={12} color={isDarkMode ? '#AD94FF' : '#ccc'} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 20,
    elevation: 3,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  avatarSection: {
    position: 'relative',
    marginRight: 14,
  },
  gradientRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  textSection: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    maxWidth: 200,
  },
  storyInfo: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowSection: {
    marginLeft: 8,
    paddingRight: 4,
  },
});
