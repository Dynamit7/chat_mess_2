
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Linking,
  Platform,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useTheme } from '../../ThemeContext';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Video } from 'expo-av';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BASE_URL, fixFileUrl } from "../../src/config";
import VideoCirclePlayer from './VideoCirclePlayer';
import PollMessage from './PollMessage';

const URL_SPLIT_REGEX = /(https?:\/\/[^\s]+)/g;
const isUrl = (s) => /^https?:\/\//.test(s);

const TextWithLinks = ({ text, isLeft, isDarkMode }) => {
  const parts = String(text).split(URL_SPLIT_REGEX);
  const textColor = !isLeft ? '#FFFFFF' : isDarkMode ? '#F5F7FA' : '#1E293B';
  const linkColor = !isLeft ? '#C4B5FD' : '#7C5CFF';
  return (
    <Text style={{ fontSize: 15, lineHeight: 21, color: textColor }}>
      {parts.map((part, i) =>
        isUrl(part) ? (
          <Text
            key={i}
            style={{ textDecorationLine: 'underline', color: linkColor }}
            onPress={() => Linking.openURL(part)}
          >
            {part}
          </Text>
        ) : part
      )}
    </Text>
  );
};

const LocationMessage = ({ latitude, longitude, isLeft }) => (
  <TouchableOpacity
    style={[
      locationStyles.card,
      !isLeft && { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.2)' },
    ]}
    onPress={() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`)}
    activeOpacity={0.8}
  >
    <MaterialCommunityIcons name="map-marker" size={28} color={isLeft ? '#7C5CFF' : '#fff'} />
    <View style={{ marginLeft: 10, flex: 1 }}>
      <Text style={[locationStyles.title, !isLeft && { color: '#fff' }]}>Местоположение</Text>
      <Text style={[locationStyles.coords, !isLeft && { color: 'rgba(255,255,255,0.7)' }]}>
        {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </Text>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={20} color={isLeft ? '#94A3B8' : 'rgba(255,255,255,0.5)'} />
  </TouchableOpacity>
);

const locationStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,92,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.2)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 220,
  },
  title: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  coords: { fontSize: 11, color: '#64748B', marginTop: 2 },
});

const EmojiPicker = ({ onSelect, isDarkMode }) => {
  const emojis = ['👍', '❤️', '🔥', '👏', '😮', '😢', '😡', '🎉'];
  return (
    <View
      style={[
        styles.emojiPicker,
        isDarkMode && { backgroundColor: '#121826', borderColor: 'rgba(255,255,255,0.08)' }
      ]}
      onStartShouldSetResponder={() => true}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {emojis.map((emoji) => (
        <TouchableOpacity key={emoji} onPress={() => onSelect(emoji)} style={styles.emojiButton}>
          <Text style={styles.emojiPickerText}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const groupReactions = (reactions) => {
  const grouped = {};
  for (const reaction of reactions) {
    if (grouped[reaction.emoji]) {
      grouped[reaction.emoji]++;
    } else {
      grouped[reaction.emoji] = 1;
    }
  }
  return grouped;
};

const Message = ({
  time,
  isLeft,
  message,
  onSwipe,
  replyTo,
  currentUserId,
  onDelete,
  onEdit,
  onReply,
  onMessagePress,
  onLongPressMessage,
  isEmojiPickerOpen,
  socket,
  isHighlighted,
  onHighlightMessage,
  isMultiSelect,
  setMultiSelect,
  isSelected,
  onSelectMessage,
  translation,
  onTranslate,
  ref,
}) => {
    const { isDarkMode } = useTheme();
    const [lightboxVisible, setLightboxVisible] = useState(false);
    const startingPosition = 0;
    const x = useSharedValue(startingPosition);
    const [reactions, setReactions] = useState(message.reactions || []);
    const touchStartY = useRef(0);
    const touchStartX = useRef(0);
    const touchStartTime = useRef(0);
    const isScrolling = useRef(false);
    const hasMoved = useRef(false);
    const longPressTriggered = useRef(false);
    const longPressTimer = useRef(null);

    const swipeThreshold = 60; // Увеличен порог для более точного распознавания
    const maxSwipeOffset = 80;
    const horizontalSwipeRatio = 1.5; // Минимальное соотношение горизонтального к вертикальному движению

    const panGesture = Gesture.Pan()
      .activeOffsetX([-25, 25]) // Активация только при чётком горизонтальном движении (25px)
      .failOffsetY([-10, 10]) // Быстро отменяется при вертикальном движении (скролл)
      .onUpdate((event) => {
        if (isMultiSelect) return;
        
        // Проверяем, что движение в основном горизонтальное
        const absX = Math.abs(event.translationX);
        const absY = Math.abs(event.translationY);
        
        // Если вертикальное движение больше горизонтального, не обрабатываем
        if (absY > absX / horizontalSwipeRatio) {
          return;
        }
        
        const clamped = Math.max(
          -maxSwipeOffset,
          Math.min(maxSwipeOffset, event.translationX)
        );
        x.value = startingPosition + clamped;
      })
      .onEnd((event) => {
        if (isMultiSelect) return;
        
        const absX = Math.abs(event.translationX);
        const absY = Math.abs(event.translationY);
        
        // Проверяем, что это действительно горизонтальный свайп
        if (absX > swipeThreshold && absX > absY * horizontalSwipeRatio) {
          const directionOffset = event.translationX > 0 ? 50 : -50;
          x.value = withSpring(directionOffset);
          if (typeof onSwipe === 'function') {
            runOnJS(onSwipe)(message, isLeft);
          }
        } else {
          // Если не достигнут порог, возвращаем в исходное положение
          x.value = withSpring(startingPosition);
        }
      })
      .onFinalize(() => {
        x.value = withSpring(startingPosition);
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: x.value }],
    }));

    const handleLongPress = () => {
      // Отмечаем, что long press был выполнен
      longPressTriggered.current = true;
      
      setMultiSelect(true);
      // immediately add to selected via the parent handler:
      if (typeof onLongPressMessage === 'function') {
        onLongPressMessage(message.id);
      }
    };

    const handleMessagePress = () => {
      // Если был скролл, не обрабатываем тап
      if (isScrolling.current || hasMoved.current) {
        isScrolling.current = false;
        hasMoved.current = false;
        return;
      }
      onMessagePress(message.id);
    };

    const handleTouchStart = (evt) => {
      touchStartY.current = evt.nativeEvent.pageY;
      touchStartX.current = evt.nativeEvent.pageX;
      touchStartTime.current = Date.now();
      isScrolling.current = false;
      hasMoved.current = false;
      longPressTriggered.current = false;
      
      // Устанавливаем таймер для long press
      longPressTimer.current = setTimeout(() => {
        // Проверяем, что не было значительного движения (скролла)
        if (!isScrolling.current) {
          handleLongPress();
        }
      }, 500);
    };

    const handleTouchMove = (evt) => {
      const deltaX = Math.abs(evt.nativeEvent.pageX - touchStartX.current);
      const deltaY = Math.abs(evt.nativeEvent.pageY - touchStartY.current);

      // Отменяем long press при любом значительном движении (горизонтальном или вертикальном)
      if ((deltaX > 15 || deltaY > 15) && longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        hasMoved.current = true;
      }

      // Если вертикальное движение значительно больше горизонтального, это скролл
      if (deltaY > deltaX * 1.5 && deltaY > 20) {
        isScrolling.current = true;
        hasMoved.current = true;
      }
    };

    const handleTouchEnd = () => {
      // Отменяем таймер long press
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      
      // Если был long press, не обрабатываем обычный тап
      if (longPressTriggered.current) {
        isScrolling.current = false;
        hasMoved.current = false;
        longPressTriggered.current = false;
        return;
      }
      
      if (!isScrolling.current && !hasMoved.current) {
        // Это был тап, а не скролл
        handleMessagePress();
      }
      
      isScrolling.current = false;
      hasMoved.current = false;
      longPressTriggered.current = false;
    };

    // Обработчики для определения скролла vs тапа
    const onStartShouldSetResponder = () => {
      // Не перехватываем событие при старте, позволяя ScrollView обработать его
      return false;
    };

    const onMoveShouldSetResponder = (evt) => {
      const { moveX, moveY } = evt.nativeEvent;
      const deltaX = Math.abs(moveX - touchStartX.current);
      const deltaY = Math.abs(moveY - touchStartY.current);
      
      // Если вертикальное движение больше горизонтального, это скролл - не перехватываем
      if (deltaY > deltaX && deltaY > 5) {
        isScrolling.current = true;
        hasMoved.current = true;
        return false; // Не перехватываем, позволяя ScrollView обработать скролл
      }
      
      // Если горизонтальное движение, это может быть swipe для ответа - перехватываем
      if (deltaX > deltaY && deltaX > 10) {
        hasMoved.current = true;
        return true; // Перехватываем для обработки swipe
      }
      
      // По умолчанию не перехватываем
      return false;
    };

    const onResponderGrant = (evt) => {
      touchStartY.current = evt.nativeEvent.pageY;
      touchStartX.current = evt.nativeEvent.pageX;
      isScrolling.current = false;
      hasMoved.current = false;
    };

    const handleReplyPress = () => {
      if (replyTo && replyTo.id) {
        onHighlightMessage(replyTo.id);
      }
    };

    const handleEmojiSelect = async (emoji) => {
      const existingReaction = reactions.find(
        (r) => r.emoji === emoji && r.userId === currentUserId
      );
      if (existingReaction) {
        await fetch(`${BASE_URL}/api/messages/removeReaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: message.id, userId: currentUserId, emoji }),
        });
        socket.emit('removeReaction', { messageId: message.id, userId: currentUserId, emoji });
      } else {
        await fetch(`${BASE_URL}/api/messages/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: message.id, userId: currentUserId, emoji }),
        });
        socket.emit('addReaction', { messageId: message.id, userId: currentUserId, emoji });
      }
    };

    const handleReactionPress = async (emoji) => {
      const existingReaction = reactions.find(
        (r) => r.emoji === emoji && r.userId === currentUserId
      );
      if (existingReaction) {
        await fetch(`${BASE_URL}/api/messages/removeReaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: message.id, userId: currentUserId, emoji }),
        });
        socket.emit('removeReaction', { messageId: message.id, userId: currentUserId, emoji });
      } else {
        await fetch(`${BASE_URL}/api/messages/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: message.id, userId: currentUserId, emoji }),
        });
        socket.emit('addReaction', { messageId: message.id, userId: currentUserId, emoji });
      }
    };

    useEffect(() => {
      const handleReactionAdded = (reaction) => {
        if (reaction.messageId === message.id) {
          setReactions((prev) => [...prev, reaction]);
        }
      };
      const handleReactionRemoved = (reaction) => {
        if (reaction.messageId === message.id) {
          setReactions((prev) =>
            prev.filter(
              (r) => !(r.emoji === reaction.emoji && r.userId === reaction.userId)
            )
          );
        }
      };
      socket.on('reactionAdded', handleReactionAdded);
      socket.on('reactionRemoved', handleReactionRemoved);
      return () => {
        socket.off('reactionAdded', handleReactionAdded);
        socket.off('reactionRemoved', handleReactionRemoved);
      };
    }, [socket, message.id]);

    const groupedReactions = groupReactions(reactions);
    const isOwnMessage = String(message.fromUserId) === String(currentUserId);

    const renderContent = () => {
      if (message.type && message.type !== 'text') {
        switch (message.type) {
          case 'image':
            return (
              <>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setLightboxVisible(true)}
                >
                  <View style={styles.mediaContainer}>
                    <Image source={{ uri: fixFileUrl(message.fileUrl) }} style={styles.media} />
                  </View>
                </TouchableOpacity>
                <Modal
                  visible={lightboxVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setLightboxVisible(false)}
                  statusBarTranslucent
                >
                  <StatusBar hidden />
                  <TouchableOpacity
                    style={styles.lightboxOverlay}
                    activeOpacity={1}
                    onPress={() => setLightboxVisible(false)}
                  >
                    <Image
                      source={{ uri: fixFileUrl(message.fileUrl) }}
                      style={styles.lightboxImage}
                      resizeMode="contain"
                    />
                    <View style={styles.lightboxCloseBtn}>
                      <MaterialCommunityIcons name="close" size={26} color="#fff" />
                    </View>
                  </TouchableOpacity>
                </Modal>
              </>
            );
          case 'video':
            return (
              <View style={styles.mediaContainer}>
                <Video
                  source={{ uri: fixFileUrl(message.fileUrl) }}
                  style={styles.media}
                  useNativeControls
                  resizeMode="cover"
                />
              </View>
            );
          case 'video_circle':
            return (
              <VideoCirclePlayer uri={fixFileUrl(message.fileUrl)} />
            );
          case 'location':
            return (
              <LocationMessage
                latitude={message.latitude}
                longitude={message.longitude}
                isLeft={isLeft}
              />
            );
          case 'file': {
            const fname = message.filename || message.fileUrl || '';
            const isImageFile = /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(fname);
            if (isImageFile) {
              return (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setLightboxVisible(true)}
                  >
                    <View style={styles.mediaContainer}>
                      <Image source={{ uri: fixFileUrl(message.fileUrl) }} style={styles.media} />
                    </View>
                  </TouchableOpacity>
                  <Modal
                    visible={lightboxVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setLightboxVisible(false)}
                    statusBarTranslucent
                  >
                    <StatusBar hidden />
                    <TouchableOpacity
                      style={styles.lightboxOverlay}
                      activeOpacity={1}
                      onPress={() => setLightboxVisible(false)}
                    >
                      <Image
                        source={{ uri: fixFileUrl(message.fileUrl) }}
                        style={styles.lightboxImage}
                        resizeMode="contain"
                      />
                      <View style={styles.lightboxCloseBtn}>
                        <MaterialCommunityIcons name="close" size={26} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  </Modal>
                </>
              );
            }
            return (
              <TouchableOpacity
                onPress={() => Linking.openURL(fixFileUrl(message.fileUrl))}
                style={styles.fileContainer}
              >
                <View style={styles.fileIconContainer}>
                  <Text style={styles.fileIcon}>📄</Text>
                </View>
                <Text
                  style={[styles.fileName, isLeft ? styles.leftText : styles.rightText]}
                  numberOfLines={2}
                  ellipsizeMode="middle"
                >
                  {fname || 'Файл'}
                </Text>
              </TouchableOpacity>
            );
          }
          case 'voice':
            return (
              <View style={styles.mediaContainer}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const soundObject = new Audio.Sound();
                      await soundObject.loadAsync({ uri: fixFileUrl(message.fileUrl) });
                      await soundObject.playAsync();
                    } catch (error) {
                      console.log('Ошибка при воспроизведении', error);
                    }
                  }}
                  style={styles.fileContainer}
                >
                  <View style={styles.fileIconContainer}>
                    <Text style={styles.fileIcon}>🔊</Text>
                  </View>
                  <Text style={[styles.fileName, isLeft ? styles.leftText : styles.rightText]}>
                    Голосовое сообщение
                  </Text>
                </TouchableOpacity>
              </View>
            );
          case 'poll':
            return (
              <View style={{ width: 280, maxWidth: '100%' }}>
                <PollMessage poll={message.poll} pollId={message.pollId} />
              </View>
            );
          default:
            return null;
        }
      }
      return <TextWithLinks
        text={message.text || message}
        isLeft={isLeft}
        isDarkMode={isDarkMode}
      />;
    };

    const renderReply = () => {
      if (!replyTo) return null;

      const replyText = replyTo.text
        ? replyTo.text
        : replyTo.filename
        ? replyTo.filename
        : '';
      const replyUsername = replyTo.fromUserId === currentUserId ? 'Вы' : 'Собеседник';

      return (
        <TouchableOpacity
          onPress={handleReplyPress}
          style={[
            styles.replyContainer,
            !isLeft && {
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderLeftColor: '#fff',
            },
            isLeft && isDarkMode && {
              backgroundColor: 'rgba(124, 92, 255, 0.15)',
            },
          ]}
        >
          <View style={[
            styles.replyBorder,
            !isLeft && { backgroundColor: '#fff' },
          ]} />
          <Text style={[
            styles.replyUsername,
            !isLeft && { color: '#fff' },
            isLeft && isDarkMode && { color: '#C4B5FD' },
          ]}>{replyUsername}</Text>
          <Text
            style={[
              styles.replyText,
              !isLeft && { color: 'rgba(255, 255, 255, 0.8)' },
              isLeft && isDarkMode && { color: 'rgba(255, 255, 255, 0.5)' },
            ]}
            numberOfLines={2}
          >
            {replyText.length > 50 ? replyText.slice(0, 50) + '...' : replyText}
          </Text>
        </TouchableOpacity>
      );
    };

    const renderChecks = () => {
      if (!isLeft) {
        return message.isRead ? '✔✔' : '✔';
      }
      return '';
    };

    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.container,
            animatedStyle,
            isHighlighted && styles.highlightedContainer,
            isSelected && styles.selectedContainer,
          ]}
          ref={ref}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.messageContainer,
              isLeft
                ? [styles.leftMessage, isDarkMode && { backgroundColor: 'rgba(255,255,255,0.08)' }]
                : styles.rightMessage,
            ]}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onStartShouldSetResponder={() => false}
            onMoveShouldSetResponder={() => false}
          >
            {renderReply()}
            {message.forwardedFromUsername ? (
              <View style={styles.forwardedLabel}>
                <MaterialCommunityIcons name="share" size={12} color={isLeft ? '#7C5CFF' : 'rgba(255,255,255,0.8)'} />
                <Text style={[
                  styles.forwardedText,
                  isLeft
                    ? { color: '#7C5CFF' }
                    : { color: 'rgba(255,255,255,0.8)' }
                ]}>
                  Переслано от {message.forwardedFromUsername}
                </Text>
              </View>
            ) : null}
            <View style={styles.messageView}>{renderContent()}</View>

            {/* Translation */}
            {translation?.text && (
              <View style={[
                styles.translationBlock,
                !isLeft
                  ? { backgroundColor: 'rgba(255,255,255,0.12)' }
                  : { backgroundColor: isDarkMode ? 'rgba(124, 92, 255, 0.1)' : 'rgba(124, 92, 255, 0.06)' },
              ]}>
                <Text style={[
                  styles.translationLabel,
                  !isLeft ? { color: 'rgba(255,255,255,0.6)' } : { color: '#7C5CFF' },
                ]}>Перевод</Text>
                <Text style={[
                  styles.translationText,
                  !isLeft ? { color: '#fff' } : { color: isDarkMode ? '#F5F7FA' : '#333' },
                ]}>{translation.text}</Text>
              </View>
            )}
            {translation?.error && (
              <Text style={styles.translationError}>{translation.error}</Text>
            )}

            <View style={styles.timeView}>
              {/* Translate button */}
              {onTranslate && (message.text || message.type === 'text') && !isMultiSelect && (
                <TouchableOpacity
                  onPress={() => onTranslate(message.id, message.text)}
                  style={styles.translateBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="translate"
                    size={13}
                    color={!isLeft ? 'rgba(255,255,255,0.5)' : (isDarkMode ? 'rgba(255,255,255,0.3)' : '#aaa')}
                  />
                </TouchableOpacity>
              )}
              {message.isEdited && (
                <Text style={[
                  styles.editedLabel,
                  !isLeft && { color: 'rgba(255,255,255,0.5)' },
                  isLeft && isDarkMode && { color: 'rgba(255,255,255,0.4)' },
                ]}>изменено</Text>
              )}
              <Text style={[
                styles.time,
                !isLeft && styles.rightTime,
                isLeft && isDarkMode && { color: 'rgba(255,255,255,0.4)' },
              ]}>{time}</Text>
              {!isLeft && <Text style={styles.checks}>{renderChecks()}</Text>}
            </View>
          </View>

          {isEmojiPickerOpen && !isMultiSelect && <EmojiPicker onSelect={handleEmojiSelect} isDarkMode={isDarkMode} />}

          {Object.keys(groupedReactions).length > 0 && (
            <View
              style={[styles.reactionsContainer, isLeft ? styles.leftReactions : styles.rightReactions]}
            >
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <TouchableOpacity key={emoji} onPress={() => handleReactionPress(emoji)}>
                  <View style={[
                    styles.reactionBubble,
                    isDarkMode && { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.06)' }
                  ]}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    {count > 1 && <Text style={[
                      styles.reactionCount,
                      isDarkMode && { color: 'rgba(255,255,255,0.5)' }
                    ]}>{count}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    );
};

const styles = StyleSheet.create({
  forwardedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  forwardedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  container: {
    marginVertical: 3,
    marginHorizontal: 12,
  },
  highlightedContainer: {
    borderRadius: 22,
    backgroundColor: 'rgba(124, 92, 255, 0.1)',
  },
  selectedContainer: {
    borderRadius: 22,
    backgroundColor: 'rgba(124, 92, 255, 0.08)',
  },
  messageContainer: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  leftMessage: {
    backgroundColor: '#F5F7FA',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
  },
  rightMessage: {
    backgroundColor: '#7C5CFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  messageView: {
    marginBottom: 4,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
  },
  leftText: {
    color: '#1E293B',
  },
  rightText: {
    color: '#FFFFFF',
  },
  timeView: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  time: {
    fontSize: 11,
    color: '#94A3B8',
  },
  rightTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  checks: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  translationBlock: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
  },
  translationLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  translationText: {
    fontSize: 14,
  },
  translationError: {
    fontSize: 11,
    color: '#ff6b6b',
    marginTop: 4,
  },
  translateBtn: {
    padding: 2,
    marginRight: 2,
  },
  editedLabel: {
    fontSize: 10,
    color: '#aaa',
    marginRight: 3,
    fontStyle: 'italic',
  },
  mediaContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  media: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
  },
  fileIconContainer: {
    marginRight: 10,
  },
  fileIcon: {
    fontSize: 22,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  replyContainer: {
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7C5CFF',
    marginBottom: 6,
    backgroundColor: 'rgba(124, 92, 255, 0.08)',
    borderRadius: 10,
  },
  replyBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#7C5CFF',
  },
  replyUsername: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C5CFF',
  },
  replyText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  emojiPicker: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  emojiButton: {
    padding: 5,
  },
  emojiPickerText: {
    fontSize: 22,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  leftReactions: {
    justifyContent: 'flex-start',
  },
  rightReactions: {
    justifyContent: 'flex-end',
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    marginLeft: 3,
    color: '#64748B',
    fontWeight: '500',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 22,
    padding: 8,
  },
});

export default Message;