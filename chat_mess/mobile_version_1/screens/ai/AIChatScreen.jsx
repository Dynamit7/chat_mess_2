/**
 * AIChatScreen
 * Chat interface with AI assistant
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
  FadeInDown,
  FadeInUp,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

import { BASE_URL } from '../../src/config';

const TypingIndicator = () => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 300 }),
        withTiming(0, { duration: 300 })
      ),
      -1
    );
    setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        -1
      );
    }, 150);
    setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 300 }),
          withTiming(0, { duration: 300 })
        ),
        -1
      );
    }, 300);
  }, []);

  const style1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const style2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const style3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View style={styles.typingContainer}>
      <Animated.View style={[styles.typingDot, style1]} />
      <Animated.View style={[styles.typingDot, style2]} />
      <Animated.View style={[styles.typingDot, style3]} />
    </View>
  );
};

const MessageBubble = ({ message, onCopy, onRegenerate }) => {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      layout={Layout.springify()}
      style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}
    >
      {!isUser && (
        <LinearGradient
          colors={['#FF2D55', '#7C5CFF']}
          style={styles.aiAvatar}
        >
          <Ionicons name="sparkles" size={16} color="#fff" />
        </LinearGradient>
      )}

      <TouchableOpacity
        style={[styles.messageContent, isUser ? styles.userContent : styles.aiContent]}
        onLongPress={() => setShowActions(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
          {message.content}
        </Text>

        {!isUser && (
          <Text style={styles.messageTime}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </TouchableOpacity>

      {showActions && !isUser && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={styles.actionsContainer}
        >
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              onCopy?.(message.content);
              setShowActions(false);
            }}
          >
            <Ionicons name="copy-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              onRegenerate?.();
              setShowActions(false);
            }}
          >
            <Ionicons name="refresh-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const AIChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  const { conversationId: initialConversationId } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [conversationTitle, setConversationTitle] = useState('New Chat');

  const getToken = useCallback(async () => {
    return await AsyncStorage.getItem('token');
  }, []);

  // Load conversation if exists
  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, [initialConversationId]);

  const loadConversation = async (id) => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/ai/conversations/${id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();

      if (response.ok) {
        setMessages(data.messages || []);
        setConversationTitle(data.conversation?.title || 'Chat');
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isSending) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);
    Keyboard.dismiss();

    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          model: 'gpt-4',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setConversationId(data.conversationId);
        setMessages(prev => [...prev, data.message]);

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        // Add error message
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Failed to connect. Please check your internet connection.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, conversationId, getToken]);

  const handleCopy = useCallback(async (text) => {
    await Clipboard.setStringAsync(text);
    // Show toast
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setConversationTitle('New Chat');
  }, []);

  const renderItem = useCallback(({ item }) => (
    <MessageBubble
      message={item}
      onCopy={handleCopy}
    />
  ), [handleCopy]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <LinearGradient
            colors={['#FF2D55', '#7C5CFF']}
            style={styles.headerAvatar}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerSubtitle}>
              {isSending ? 'Typing...' : 'Online'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.headerButton} onPress={handleNewChat}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF2D55" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={['#FF2D55', '#7C5CFF']}
            style={styles.emptyAvatar}
          >
            <Ionicons name="sparkles" size={48} color="#fff" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>AI Assistant</Text>
          <Text style={styles.emptySubtitle}>
            Ask me anything! I can help with coding, writing, analysis, and more.
          </Text>

          {/* Suggestion chips */}
          <View style={styles.suggestions}>
            {['Explain a concept', 'Write code', 'Translate text', 'Summarize'].map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                style={styles.suggestionChip}
                onPress={() => setInputText(suggestion + '...')}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          ListFooterComponent={
            isSending ? (
              <View style={styles.typingBubble}>
                <LinearGradient
                  colors={['#FF2D55', '#7C5CFF']}
                  style={styles.aiAvatar}
                >
                  <Ionicons name="sparkles" size={16} color="#fff" />
                </LinearGradient>
                <View style={styles.aiContent}>
                  <TypingIndicator />
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <BlurView intensity={80} tint="dark" style={styles.inputBlur}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Message AI..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <LinearGradient
                colors={inputText.trim() ? ['#FF2D55', '#7C5CFF'] : ['#333', '#333']}
                style={styles.sendButtonGradient}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </LinearGradient>
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
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
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
    paddingHorizontal: 32,
  },
  emptyAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestionText: {
    color: '#fff',
    fontSize: 14,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageContent: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '100%',
  },
  userContent: {
    backgroundColor: '#FF2D55',
  },
  aiContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  messageTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 6,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  actionsContainer: {
    flexDirection: 'row',
    marginLeft: 8,
    gap: 4,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
    maxHeight: 120,
    paddingVertical: 8,
  },
  sendButton: {
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AIChatScreen;
