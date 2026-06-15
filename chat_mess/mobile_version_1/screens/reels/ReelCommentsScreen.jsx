/**
 * ReelCommentsScreen
 * Comments bottom sheet for Reels
 * Super-App Messenger 2026
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../src/config';

const formatTimeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const posted = new Date(date);
  const diffMs = now - posted;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
};

const CommentItem = ({ comment, onLike, onReply, onUserPress }) => {
  const [isLiked, setIsLiked] = useState(comment.isLiked || false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const likeScale = useSharedValue(1);

  const handleLike = useCallback(() => {
    likeScale.value = withSpring(1.3, { damping: 5 }, () => {
      likeScale.value = withSpring(1);
    });
    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    onLike?.(comment.id, !isLiked);
  }, [comment.id, isLiked, onLike]);

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      layout={Layout.springify()}
      style={styles.commentItem}
    >
      <TouchableOpacity onPress={() => onUserPress?.(comment.user)}>
        <Image
          source={{ uri: comment.user?.avatar || 'https://via.placeholder.com/40' }}
          style={styles.commentAvatar}
        />
      </TouchableOpacity>

      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <TouchableOpacity onPress={() => onUserPress?.(comment.user)}>
            <Text style={styles.commentUsername}>
              {comment.user?.username || 'user'}
            </Text>
          </TouchableOpacity>
          {comment.user?.isVerified && (
            <Ionicons name="checkmark-circle" size={12} color="#00A3FF" />
          )}
          <Text style={styles.commentTime}>
            {formatTimeAgo(comment.createdAt)}
          </Text>
        </View>

        <Text style={styles.commentText}>{comment.text}</Text>

        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.commentAction}
            onPress={() => onReply?.(comment)}
          >
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity>

          {comment.repliesCount > 0 && (
            <TouchableOpacity style={styles.commentAction}>
              <Text style={styles.viewRepliesText}>
                View {comment.repliesCount} {comment.repliesCount === 1 ? 'reply' : 'replies'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.View style={likeAnimatedStyle}>
        <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? '#FF2D55' : 'rgba(255,255,255,0.5)'}
          />
          {likesCount > 0 && (
            <Text style={[styles.likeCount, isLiked && styles.likeCountActive]}>
              {likesCount}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const ReelCommentsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);

  const { reelId, reel } = route.params || {};

  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const getToken = useCallback(async () => {
    return await AsyncStorage.getItem('token');
  }, []);

  // Fetch comments
  const fetchComments = useCallback(async (pageNum = 1) => {
    if (!reelId) return;

    try {
      const token = await getToken();
      const response = await fetch(
        `${BASE_URL}/api/reels/${reelId}/comments?page=${pageNum}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (pageNum === 1) {
        setComments(data.comments || []);
      } else {
        setComments(prev => [...prev, ...(data.comments || [])]);
      }

      setHasMore(data.comments?.length === 20);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [reelId, getToken]);

  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      fetchComments(page + 1);
    }
  }, [isLoadingMore, hasMore, page, fetchComments]);

  // Send comment
  const handleSendComment = useCallback(async () => {
    if (!commentText.trim() || isSending) return;

    setIsSending(true);
    Keyboard.dismiss();

    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/reels/${reelId}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: commentText.trim(),
          parentCommentId: replyingTo?.id || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (replyingTo) {
          // Add as reply (TODO: implement replies nested view)
          setComments(prev => [data.comment, ...prev]);
        } else {
          setComments(prev => [data.comment, ...prev]);
        }
        setCommentText('');
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('Error sending comment:', err);
    } finally {
      setIsSending(false);
    }
  }, [commentText, isSending, reelId, replyingTo, getToken]);

  const handleReply = useCallback((comment) => {
    setReplyingTo(comment);
    setCommentText(`@${comment.user?.username} `);
    inputRef.current?.focus();
  }, []);

  const handleUserPress = useCallback((user) => {
    navigation.navigate('UserProfile', { userId: user?.id });
  }, [navigation]);

  const handleLikeComment = useCallback(async (commentId, liked) => {
    try {
      const token = await getToken();
      await fetch(`${BASE_URL}/api/reels/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  }, [getToken]);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
    setCommentText('');
  }, []);

  const renderItem = useCallback(({ item }) => (
    <CommentItem
      comment={item}
      onLike={handleLikeComment}
      onReply={handleReply}
      onUserPress={handleUserPress}
    />
  ), [handleLikeComment, handleReply, handleUserPress]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerHandle} />
        <Text style={styles.headerTitle}>
          {reel?.commentsCount || comments.length} comments
        </Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Comments List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF2D55" />
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>No comments yet</Text>
          <Text style={styles.emptySubtext}>Be the first to comment!</Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                size="small"
                color="#FF2D55"
                style={styles.loadingMore}
              />
            ) : null
          }
        />
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <View style={styles.replyIndicator}>
          <Text style={styles.replyText}>
            Replying to <Text style={styles.replyUsername}>@{replyingTo.user?.username}</Text>
          </Text>
          <TouchableOpacity onPress={cancelReply}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <BlurView intensity={80} tint="dark" style={styles.inputBlur}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !commentText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendComment}
            disabled={!commentText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={commentText.trim() ? '#FF2D55' : 'rgba(255,255,255,0.3)'}
              />
            )}
          </TouchableOpacity>
        </BlurView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 50,
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
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  commentUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  commentText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  commentAction: {
    paddingVertical: 2,
  },
  commentActionText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  viewRepliesText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  likeButton: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  likeCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  likeCountActive: {
    color: '#FF2D55',
  },
  loadingMore: {
    paddingVertical: 20,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  replyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  replyUsername: {
    color: '#FF2D55',
    fontWeight: '600',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputBlur: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default ReelCommentsScreen;
