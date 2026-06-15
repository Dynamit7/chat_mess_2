import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../ThemeContext";
import socket from "../src/socket";
import { BASE_URL, fixFileUrl } from "../src/config";

const getValidAvatarUri = (picture) => {
  if (!picture || typeof picture !== 'string' || picture === 'null' || picture === 'undefined') return null;
  const trimmed = picture.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http')) return fixFileUrl(trimmed);
  if (trimmed.startsWith('/')) return `${BASE_URL}${trimmed}`;
  return `${BASE_URL}/${trimmed}`;
};

// Avatar component that always shows fallback, overlays image on top
function Avatar({ uri, name, size, fontSize }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [uri]);

  const showImg = uri && !error;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      {/* Fallback always rendered underneath */}
      <LinearGradient
        colors={['#7C5CFF', '#00C2FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize, fontWeight: '700' }}>
          {name?.[0]?.toUpperCase() || "?"}
        </Text>
      </LinearGradient>

      {/* Image on top — hides fallback when loaded */}
      {showImg && (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: loaded ? 1 : 0,
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </View>
  );
}

const messageTypeLabels = {
  image: "Фото",
  video: "Видео",
  file: "Файл",
  voice: "Голосовое сообщение",
  audio: "Аудио",
  sticker: "Стикер",
};

export default function ConversationItem({
  id,
  picture,
  username,
  bio,
  lastMessage: initialLastMessage,
  lastMessageType: initialLastMessageType,
  isForwarded: initialIsForwarded,
  time: initialTime,
  notification,
  selectedChats,
  setSelectedChats,
  isSelectionMode,
  setIsSelectionMode,
  unreadCount,
  onChatOpened,
  isPinned,
  onLongPress,
}) {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [lastMessage, setLastMessage] = useState(initialLastMessage || "");
  const [lastMessageType, setLastMessageType] = useState(initialLastMessageType || "text");
  const [isForwarded, setIsForwarded] = useState(initialIsForwarded || false);
  const [time, setTime] = useState(initialTime || "");

  const avatarUri = getValidAvatarUri(picture);

  const getDisplayMessage = (message, type) => {
    if (type && type !== "text" && messageTypeLabels[type]) {
      if (!message || !message.trim()) return messageTypeLabels[type];
      // Has both type label and text caption
      const cleaned = message.trim().replace(/[\x00-\x1F\x7F]/g, '');
      if (!cleaned) return messageTypeLabels[type];
      const combined = `${messageTypeLabels[type]}: ${cleaned}`;
      return combined.length > 40 ? combined.substring(0, 38) + "..." : combined;
    }
    if (!message || typeof message !== "string") return "";
    const cleanedMessage = message.trim().replace(/[\x00-\x1F\x7F]/g, '');
    if (cleanedMessage.length === 0) return "";
    if (cleanedMessage.length > 40) {
      return cleanedMessage.substring(0, 38) + "...";
    }
    return cleanedMessage;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
      }
    } catch {
      return timeStr;
    }
  };

  useEffect(() => {
    const handleLastMessageUpdated = ({ partnerId, lastMessage: newLastMessage, time: newTime, lastMessageType: newType, isForwarded: newIsForwarded }) => {
      if (Number(partnerId) === Number(id)) {
        setLastMessage(newLastMessage || "");
        setTime(newTime || "");
        if (newType) setLastMessageType(newType);
        setIsForwarded(!!newIsForwarded);
      }
    };

    socket.on("lastMessageUpdated", handleLastMessageUpdated);
    return () => {
      socket.off("lastMessageUpdated", handleLastMessageUpdated);
    };
  }, [id]);

  useEffect(() => {
    setLastMessage(initialLastMessage || "");
    setLastMessageType(initialLastMessageType || "text");
    setIsForwarded(initialIsForwarded || false);
    setTime(initialTime || "");
  }, [initialLastMessage, initialLastMessageType, initialIsForwarded, initialTime]);

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
      return;
    }
    if (!isSelectionMode) {
      setIsSelectionMode(true);
    }
    if (!selectedChats.includes(username)) {
      setSelectedChats([...selectedChats, username]);
    }
  };

  const handlePress = () => {
    if (isSelectionMode) {
      if (selectedChats.includes(username)) {
        const updatedSelectedChats = selectedChats.filter(
          (chat) => chat !== username
        );
        setSelectedChats(updatedSelectedChats);
        if (updatedSelectedChats.length === 0) {
          setIsSelectionMode(false);
        }
      } else {
        setSelectedChats([...selectedChats, username]);
      }
    } else {
      if (onChatOpened) onChatOpened(id);
      navigation.navigate("MessagesScreen", {
        username,
        bio,
        picture: picture,
        id,
      });
    }
  };

  const toggleModal = () => setModalVisible(!modalVisible);

  const isSelected = selectedChats.includes(username);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.conversation,
          isSelected && (isDarkMode ? styles.selectedDark : styles.selected),
        ]}
        onLongPress={handleLongPress}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <TouchableOpacity onPress={toggleModal}>
          <Avatar uri={avatarUri} name={username} size={52} fontSize={20} />
        </TouchableOpacity>
        <View style={styles.info}>
          <Text
            style={[
              styles.username,
              { color: isDarkMode ? '#F5F7FA' : '#1E293B' },
            ]}
            numberOfLines={1}
          >
            {username}
          </Text>
          <View style={styles.lastMessageRow}>
            {isForwarded && (
              <Icon
                name="share"
                size={14}
                color={isDarkMode ? 'rgba(255,255,255,0.45)' : '#64748B'}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[
                styles.lastMessage,
                { color: isDarkMode ? 'rgba(255,255,255,0.45)' : '#64748B' },
                isForwarded && { flex: 1 },
              ]}
              numberOfLines={1}
            >
              {getDisplayMessage(lastMessage, lastMessageType)}
            </Text>
          </View>
        </View>
        <View style={styles.rightSection}>
          <View style={styles.rightTop}>
            {isPinned && (
              <Icon
                name="pin"
                size={14}
                color={isDarkMode ? 'rgba(124, 92, 255, 0.8)' : '#7C5CFF'}
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={[
              styles.time,
              { color: isDarkMode ? 'rgba(255,255,255,0.35)' : '#94A3B8' },
            ]}>
              {formatTime(time)}
            </Text>
          </View>
          {unreadCount > 0 && (
            <LinearGradient
              colors={['#7C5CFF', '#5B3FE0']}
              style={styles.unreadBadge}
            >
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </LinearGradient>
          )}
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackground}
            onPress={toggleModal}
          />
          <View
            style={[
              styles.chatContainer,
              { backgroundColor: isDarkMode ? '#121826' : '#fff' },
            ]}
          >
            <View style={styles.modalHandle} />
            <View style={styles.userInfo}>
              <Avatar uri={avatarUri} name={username} size={72} fontSize={28} />
              <Text style={[
                styles.modalUsername,
                { color: isDarkMode ? '#F5F7FA' : '#1E293B' },
              ]}>
                {username}
              </Text>
              <Text style={[
                styles.modalBio,
                { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B' },
              ]}>
                {bio}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  conversation: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginVertical: 2,
    borderRadius: 16,
  },
  selected: {
    backgroundColor: 'rgba(124, 92, 255, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 92, 255, 0.35)',
  },
  selectedDark: {
    backgroundColor: 'rgba(124, 92, 255, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 92, 255, 0.40)',
  },
  info: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  username: {
    fontWeight: "600",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessage: {
    fontSize: 14,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  rightTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  unreadBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalBackground: {
    flex: 1,
    width: "100%",
  },
  chatContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: "70%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  userInfo: {
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  modalUsername: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  modalBio: {
    fontSize: 14,
    textAlign: "center",
  },
  chatScroll: {
    flex: 1,
  },
});
