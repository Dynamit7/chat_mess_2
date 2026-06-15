import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { io } from "socket.io-client";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from "../../ThemeContext";
import AddStoryCard from "./AddStoryCard";
import StoryItem from "./StoryItem";
import { BASE_URL } from "../../src/config";
import emitter from "../../screens/eventEmitter";

export default function Stories() {
  const [groupedStories, setGroupedStories] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [viewedStoryIds, setViewedStoryIds] = useState(() => new Set());
  const socketRef = useRef(null);
  const { isDarkMode } = useTheme();

  // Load viewed story IDs from storage
  useEffect(() => {
    const load = async () => {
      let userId;
      if (Platform.OS === 'web') {
        userId = localStorage.getItem('userId');
      } else {
        userId = await AsyncStorage.getItem('userId');
      }
      if (!userId) return;
      const key = `viewedStoryIds_${userId}`;
      let stored;
      if (Platform.OS === 'web') {
        stored = localStorage.getItem(key);
      } else {
        stored = await AsyncStorage.getItem(key);
      }
      if (stored) {
        setViewedStoryIds(new Set(JSON.parse(stored)));
      }
    };
    load();
  }, []);

  // Listen for newly viewed stories from StoryPreview
  useEffect(() => {
    const handler = (newIds) => {
      setViewedStoryIds(prev => new Set([...prev, ...newIds]));
    };
    emitter.on('storiesViewed', handler);
    return () => emitter.off('storiesViewed', handler);
  }, []);

  // Emit unseen stories count for tab badge
  useEffect(() => {
    if (!currentUserId) return;
    const unseenCount = groupedStories.filter(group => {
      if (Number(group.userId) === Number(currentUserId)) return false;
      return !group.stories.every(s => viewedStoryIds.has(s.id));
    }).length;
    emitter.emit('totalUnreadStories', unseenCount);
  }, [groupedStories, viewedStoryIds, currentUserId]);

  useEffect(() => {
    (async () => {
      let userId;
      if (Platform.OS === 'web') {
        userId = localStorage.getItem('userId');
      } else {
        userId = await AsyncStorage.getItem('userId');
      }
      if (!userId) return;
      setCurrentUserId(userId);

      socketRef.current = io(BASE_URL, { transports: ["websocket"], secure: true });

      socketRef.current.emit('joinRoom', `user_${userId}`);

      socketRef.current.on("newStoryCreated", () => {
        fetchStories(userId);
      });

      socketRef.current.on("storyDeleted", () => {
        fetchStories(userId);
      });

      socketRef.current.on('chatUpdated', () => {
        fetchStories(userId);
      });

      fetchStories(userId);

      return () => socketRef.current.disconnect();
    })();
  }, []);

  const fetchStories = async (userId) => {
    try {
      const res = await fetch(`${BASE_URL}/api/stories/personalized?userId=${userId}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setGroupedStories(groupStoriesByUser(data));
    } catch (err) {
      console.error("Error fetching personalized stories:", err);
    }
  };

  const groupStoriesByUser = (stories) => {
    const map = {};
    stories.forEach((story) => {
      const uId = story.userId;
      if (!map[uId]) {
        map[uId] = {
          userId: uId,
          username: story.owner?.username || "Unknown",
          avatar: story.owner?.avatar
            ? story.owner.avatar.startsWith("http")
              ? story.owner.avatar
              : `${BASE_URL}${story.owner.avatar}`
            : "",
          stories: [],
        };
      }
      map[uId].stories.push({
        id: story.id,
        fileUrl: story.fileUrl.startsWith("http")
          ? story.fileUrl
          : `${BASE_URL}${story.fileUrl}`,
        type: story.type,
        caption: story.caption,
        expiresAt: story.expiresAt,
      });
    });
    return Object.values(map);
  };

  return (
    <View>
      {currentUserId && (
        <AddStoryCard
          socketRef={socketRef}
          onStoryAdded={() => fetchStories(currentUserId)}
        />
      )}

      {groupedStories.length > 0 && (
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: '#7C5CFF' }]} />
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#AD94FF' : '#666' }]}>
            Recent Stories
          </Text>
          <View style={[styles.sectionLine, { backgroundColor: isDarkMode ? '#2a1f3d' : '#f0e6f6' }]} />
        </View>
      )}

      {groupedStories.map(item => (
        <StoryItem
          key={item.userId}
          userId={item.userId}
          picture={item.avatar}
          username={item.username}
          stories={item.stories}
          currentUserId={currentUserId}
          onStoryDeleted={() => fetchStories(currentUserId)}
          isViewed={
            Number(item.userId) !== Number(currentUserId) &&
            item.stories.length > 0 &&
            item.stories.every(s => viewedStoryIds.has(s.id))
          }
        />
      ))}

      {groupedStories.length === 0 && currentUserId && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyIcon]}>
            &#10024;
          </Text>
          <Text style={[styles.emptyTitle, { color: isDarkMode ? '#fff' : '#121826' }]}>
            No stories yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#AD94FF' : '#999' }]}>
            Be the first to share a moment!
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
  },
});
