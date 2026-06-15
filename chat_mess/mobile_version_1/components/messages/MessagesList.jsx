import { useRef, useEffect, useState, useMemo } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import Message from './Message';
import { theme } from '../../theme';
import { useTheme } from '../../ThemeContext';
import socket from '../../src/socket';
import * as Haptics from 'expo-haptics';

const MessagesList = ({
  onSwipeToReply,
  messages = [],
  currentUserId,
  onDeleteMessage,
  onEditMessage,
  onReplyMessage,
  highlightedMessageId,
  onHighlightMessage,
  isMultiSelect,
  setMultiSelect,
  selectedMessages,
  setSelectedMessages,
  translations,
  onTranslate,
}) => {
  const { isDarkMode } = useTheme();
  const scrollView = useRef(null);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState(null);
  const messageRefs = useRef({});
  const messagePositions = useRef({});

  const processedItems = useMemo(() => {
    const items = [];
    let lastDateLabel = null;

    messages.forEach((message) => {
      const currentDate = message.createdAt
        ? new Date(message.createdAt)
        : null;
      const dateLabel = currentDate
        ? currentDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year:
              currentDate.getFullYear() !== new Date().getFullYear()
                ? 'numeric'
                : undefined,
          })
        : null;

      if (dateLabel && dateLabel !== lastDateLabel) {
        lastDateLabel = dateLabel;
        items.push({
          type: 'date',
          id: `date-${currentDate?.toISOString()}`,
          label: dateLabel,
        });
      }

      items.push({ type: 'message', message });
    });

    return items;
  }, [messages]);

  useEffect(() => {
    if (scrollView.current) {
      scrollView.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    if (highlightedMessageId && messagePositions.current[highlightedMessageId] !== undefined) {
      // Используем небольшую задержку для корректного расчета позиции
      setTimeout(() => {
        const y = messagePositions.current[highlightedMessageId];
        if (y !== undefined && scrollView.current) {
          scrollView.current.scrollTo({ y: Math.max(0, y - 50), animated: true });
        }
      }, 100);
    }
  }, [highlightedMessageId]);

  const handleMessagePress = (messageId) => {
    if (isMultiSelect) {
      setSelectedMessages((prev) => {
        const updated = prev.includes(messageId)
          ? prev.filter((id) => id !== messageId)
          : [...prev, messageId];
        return updated;
      });
    } else {
      setEmojiPickerMessageId((prev) => (prev === messageId ? null : messageId));
    }
  };

  const handleMessageLongPress = (messageId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMultiSelect(true);
    setSelectedMessages((prev) =>
      prev.includes(messageId) ? prev : [...prev, messageId]
    );
  };

  useEffect(() => {
    if (isMultiSelect && selectedMessages.length === 0) {
      setMultiSelect(false);
    }
  }, [selectedMessages]);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: isDarkMode ? '#0f0f17' : theme.colors.white }]}
      contentContainerStyle={styles.content}
      ref={scrollView}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      scrollEnabled={true}
    >
      {processedItems.length ? (
        processedItems.map((item) => {
          if (item.type === 'date') {
            return (
              <View style={styles.dateSeparator} key={item.id}>
                <View style={[styles.dateChip, isDarkMode && styles.dateChipDark]}>
                  <Text style={styles.dateChipText}>{item.label}</Text>
                </View>
              </View>
            );
          }

          const message = item.message;
          return (
            <View
              key={message.id}
              onLayout={(event) => {
                const { y } = event.nativeEvent.layout;
                // Сохраняем позицию относительно ScrollView
                messagePositions.current[message.id] = y;
              }}
              collapsable={false}
              pointerEvents="box-none"
            >
              <Message
                time={
                  message.createdAt
                    ? new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''
                }
                isLeft={String(message.fromUserId) !== String(currentUserId)}
                message={message}
                onSwipe={onSwipeToReply}
                replyTo={message.replyTo}
                currentUserId={currentUserId}
                onDelete={onDeleteMessage}
                onEdit={onEditMessage}
                onReply={onReplyMessage}
                onMessagePress={handleMessagePress}
                onSelectMessage={handleMessagePress}
                onLongPressMessage={handleMessageLongPress}
                isEmojiPickerOpen={emojiPickerMessageId === message.id}
                socket={socket}
                isHighlighted={message.id === highlightedMessageId}
                onHighlightMessage={onHighlightMessage}
                isMultiSelect={isMultiSelect}
                setMultiSelect={setMultiSelect}
                isSelected={selectedMessages.includes(message.id)}
                translation={translations?.[message.id]}
                onTranslate={onTranslate}
                ref={(ref) => {
                  if (ref) {
                    messageRefs.current[message.id] = ref;
                  } else {
                    delete messageRefs.current[message.id];
                  }
                }}
              />
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyText}>Нет сообщений</Text>
      )}
    </ScrollView>
  );
};

export default MessagesList;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingVertical: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#9b9eb4',
  },
  dateSeparator: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(124, 77, 255, 0.12)',
  },
  dateChipDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7C5CFF',
    textTransform: 'capitalize',
  },
});