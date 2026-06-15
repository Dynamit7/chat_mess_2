import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import axios from "axios";
import io from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../ThemeContext";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import { BASE_URL } from "../src/config";
import emitter from "./eventEmitter";

function ChannelsListScreen({ navigation }) {
  const [channels, setChannels] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userId, setUserId] = useState(null);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [pinnedChannels, setPinnedChannels] = useState([]);
  const [showPinMenu, setShowPinMenu] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, c) => sum + (c || 0), 0);
    emitter.emit('totalUnreadChannels', total);
  }, [unreadCounts]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const socketRef = useRef(null);
  const processedMessagesRef = useRef(new Set());
  const { isDarkMode } = useTheme();

  const getUserId = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem("userId");
      if (storedUserId && storedUserId !== "null" && !isNaN(Number(storedUserId))) {
        const userIdNum = Number(storedUserId);
        setUserId(userIdNum);
        const storedPinned = await AsyncStorage.getItem(`@pinnedChannels_${userIdNum}`);
        if (storedPinned) setPinnedChannels(JSON.parse(storedPinned));
        return userIdNum;
      }
      setError("Invalid user ID");
      return null;
    } catch (err) {
      console.error("Ошибка при получении userId:", err);
      setError("Ошибка загрузки данных пользователя");
      return null;
    }
  };

  const togglePinChannel = async (channel) => {
    const isPinned = pinnedChannels.includes(channel.id);
    const updated = isPinned
      ? pinnedChannels.filter((p) => p !== channel.id)
      : [...pinnedChannels, channel.id];
    setPinnedChannels(updated);
    await AsyncStorage.setItem(`@pinnedChannels_${userId}`, JSON.stringify(updated));
  };

  useEffect(() => {
    (async () => {
      const storedUserId = await getUserId();
      if (storedUserId) {
        fetchChannels(storedUserId);
        fetchUnreadCounts(storedUserId);
      }
    })();

  }, []);



  // В ChannelsListScreen, в useEffect для socket
useEffect(() => {
  if (!userId) return;
  let mounted = true;

  const initSocket = async () => {
    let token = null;
    try { token = await AsyncStorage.getItem("token"); } catch (_) {}
    if (!mounted) return;

    const socket = io(`${BASE_URL}`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: { token: token || undefined },
    });
    socketRef.current = socket;

  socket.on("connect", () => {
    console.log("Socket connected for user:", userId);
    socket.emit("joinRoom", `user_${userId}`);
  });

  socket.on("channelCreated", (newChannel) => {
    if (
      newChannel.ownerId == userId ||
      (Array.isArray(newChannel.members) && newChannel.members.includes(Number(userId)))
    ) {
      fetchChannels();
    }
  });

  socket.on("channelAdded", (data) => {
    if (data.channelId) fetchChannels();
  });

  socket.on("channelRemoved", (data) => {
    if (data.channelId) fetchChannels();
  });

  socket.on("channelMessageReceived", (messageData) => {
    console.log("Received channelMessageReceived:", messageData, "activeChannelId:", activeChannelId);
    const messageId = String(messageData.id);
    if (processedMessagesRef.current.has(messageId)) {
      return;
    }
    processedMessagesRef.current.add(messageId);

    // Обновляем lastMessage для канала (для основных сообщений)
    if (!messageData.parentMessageId && messageData.channelId) {
      setChannels((prev) => prev.map((ch) => {
        if (ch.id === messageData.channelId || String(ch.id) === String(messageData.channelId)) {
          return {
            ...ch,
            lastMessage: messageData.text || "",
            lastMessageType: messageData.type || "text",
            lastMessageTime: messageData.createdAt || "",
            lastMessageIsForwarded: !!messageData.forwardedFromType,
          };
        }
        return ch;
      }));
    }

    // ИЗМЕНЕНИЕ: увеличиваем счетчик ТОЛЬКО для основных сообщений (не комментариев)
    if (
      String(messageData.channelId) !== String(activeChannelId) &&
      String(messageData.userId) !== String(userId) &&
      !messageData.parentMessageId // Только если это НЕ комментарий
    ) {
      setUnreadCounts((prev) => ({
        ...prev,
        [messageData.channelId]: (prev[messageData.channelId] || 0) + 1,
      }));
    }
  });

  socket.on("channelLastMessageUpdated", ({ channelId, lastMessage, lastMessageType, lastMessageTime, unreadCount }) => {
    setChannels((prev) => prev.map((ch) =>
      String(ch.id) === String(channelId)
        ? { ...ch, lastMessage: lastMessage || "", lastMessageType: lastMessageType || "text", lastMessageTime: lastMessageTime || "" }
        : ch
    ));
    // Если сервер прислал точный счётчик (после удаления) — применяем
    if (unreadCount !== undefined) {
      setUnreadCounts((prev) => ({ ...prev, [channelId]: unreadCount }));
    }
  });

    return () => { socket.disconnect(); };
  };

  initSocket();
  return () => { mounted = false; if (socketRef.current) socketRef.current.disconnect(); };
}, [userId, activeChannelId]);

  const fetchChannels = async (givenUserId) => {
    setIsLoading(true);
    setError(null);
    try {
      const uid = givenUserId || userId;
      if (!uid || uid === "null") {
        setIsLoading(false);
        return;
      }
      const response = await axios.get(
        `${BASE_URL}/api/channels?search=${searchTerm}&userId=${uid}`
      );
      console.log("Channels data:", response.data);
      const validChannels = response.data.filter(
        (item) => item.id !== undefined && item.id !== null
      );
      if (validChannels.length < response.data.length) {
        console.warn(
          "Filtered out invalid channels:",
          response.data.filter(
            (item) => !item || item.id === undefined || item.id === null
          )
        );
      }
      setChannels(validChannels);
    } catch (err) {
      console.error("Ошибка при получении списка каналов:", err.response?.data || err.message);
      setError("Ошибка загрузки каналов");
    } finally {
      setIsLoading(false);
    }
  };

const fetchUnreadCounts = async (uid) => {
  try {
    const userIdToFetch = uid || userId;
    if (!userIdToFetch || userIdToFetch === "null" || isNaN(Number(userIdToFetch))) {
      console.log("Неверный userId, пропускаем загрузку непрочитанных");
      return;
    }
    const response = await axios.get(
      `${BASE_URL}/api/channels/${userIdToFetch}/unread-counts`
    );
    const counts = {};
    response.data.forEach((item) => {
      // Игнорируем каналы с 0 непрочитанных для чистоты отображения
      if (item.unreadCount > 0) {
        counts[item.channelId] = item.unreadCount;
      }
    });
    setUnreadCounts(counts);
  } catch (err) {
    console.error("Ошибка при загрузке непрочитанных сообщений:", err);
  }
};

  const handleSearch = () => {
    fetchChannels();
    fetchUnreadCounts();
  };

  const joinChannel = async (channelId) => {
    try {
      const storedUserId = await AsyncStorage.getItem("userId");
      if (!storedUserId) {
        console.log("userId не найден в AsyncStorage");
        return;
      }
      await axios.post(`${BASE_URL}/api/channels/${channelId}/join`, {
        userId: storedUserId,
      });
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, isMember: true } : c))
      );
      setUnreadCounts((prev) => ({ ...prev, [channelId]: 0 }));
      setActiveChannelId(channelId);
      navigation.navigate("ChannelChatScreen", { channelId });
      fetchUnreadCounts();
    } catch (err) {
      console.error("Ошибка при join:", err.response?.data || err.message);
      Alert.alert("Ошибка", "Не удалось присоединиться к каналу");
    }
  };

const handleChannelPress = (channel) => {
  if (isSelectionMode) {
    setSelectedChannels((prevSelected) => {
      let newSelected;
      if (prevSelected.includes(channel.id)) {
        newSelected = prevSelected.filter((id) => id !== channel.id);
      } else {
        newSelected = [...prevSelected, channel.id];
      }
      if (newSelected.length === 0) {
        setIsSelectionMode(false);
      }
      return newSelected;
    });
  } else {
    if (channel.isMember || channel.ownerId == userId) {
      setActiveChannelId(channel.id);
      navigation.navigate("ChannelChatScreen", { channelId: channel.id });
    } else {
      joinChannel(channel.id);
    }
  }
};

  const handleChannelLongPress = (channel) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedChannels([channel.id]);
    } else {
      setSelectedChannels((prevSelected) => {
        let newSelected;
        if (prevSelected.includes(channel.id)) {
          newSelected = prevSelected.filter((id) => id !== channel.id);
        } else {
          newSelected = [...prevSelected, channel.id];
        }
        if (newSelected.length === 0) setIsSelectionMode(false);
        return newSelected;
      });
    }
  };

  const handlePinSelected = async () => {
    const allPinned = selectedChannels.every(id => pinnedChannels.includes(id));
    const updated = allPinned
      ? pinnedChannels.filter(id => !selectedChannels.includes(id))
      : [...pinnedChannels, ...selectedChannels.filter(id => !pinnedChannels.includes(id))];
    setPinnedChannels(updated);
    await AsyncStorage.setItem(`@pinnedChannels_${userId}`, JSON.stringify(updated));
    setShowPinMenu(false);
  };

  const selectAll = () => {
    const allIds = channels.map((ch) => ch.id);
    setSelectedChannels(allIds);
  };

  const deselectAll = () => {
    setSelectedChannels([]);
    setIsSelectionMode(false);
  };

  const deleteSelectedChannels = async () => {
    if (selectedChannels.length === 0) {
      setIsSelectionMode(false);
      return;
    }

    const newChannelList = [...channels];

    for (let channelId of selectedChannels) {
      const channel = channels.find((c) => c.id === channelId);
      if (!channel) continue;

      try {
        if (String(channel.ownerId) === String(userId)) {
          await axios.delete(`${BASE_URL}/api/channels/${channelId}`, {
            data: { userId },
          });
          const idx = newChannelList.findIndex((ch) => ch.id === channelId);
          if (idx !== -1) newChannelList.splice(idx, 1);
          delete unreadCounts[channelId];
        } else if (channel.isMember) {
          await axios.delete(`${BASE_URL}/api/channels/${channelId}/leave`, {
            data: { userId },
          });
          const idx = newChannelList.findIndex((ch) => ch.id === channelId);
          if (idx !== -1) newChannelList.splice(idx, 1);
          delete unreadCounts[channelId];
        }
      } catch (err) {
        console.error(
          "Ошибка при удалении/покидании канала:",
          err.response?.data || err.message
        );
      }
    }

    setChannels(newChannelList);
    setUnreadCounts({ ...unreadCounts });
    setSelectedChannels([]);
    setIsSelectionMode(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchChannels();
        fetchUnreadCounts();
      }
      setActiveChannelId(null);
    }, [userId, searchTerm])
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: isDarkMode ? "#aaa" : "#666" }]}>
        {searchTerm ? "Каналы не найдены" : "Нет каналов"}
      </Text>
    </View>
  );

  const messageTypeLabels = {
    image: "Фото", video: "Видео", file: "Файл",
    voice: "Голосовое", audio: "Аудио", sticker: "Стикер",
  };

  const formatChannelTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return "";
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (diffDays === 1) return "Вчера";
      if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
      return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
    } catch { return ""; }
  };

  const getChannelLastMessage = (item) => {
    if (!item.lastMessage && !item.lastMessageType) return item.description || "Нет описания";
    const type = item.lastMessageType;
    const text = item.lastMessage || "";
    if (type && type !== "text" && messageTypeLabels[type]) return messageTypeLabels[type];
    const cleaned = text.replace(/[\x00-\x1F\x7F]/g, "").trim();
    if (!cleaned) return item.description || "Нет описания";
    return cleaned.length > 40 ? cleaned.substring(0, 38) + "..." : cleaned;
  };

  const renderChannelItem = ({ item }) => {
    const isSelected = selectedChannels.includes(item.id);
    const unreadCount = unreadCounts[item.id] || 0;
    const isPinned = pinnedChannels.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.channelCard,
          isSelected && { backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
        ]}
        onPress={() => handleChannelPress(item)}
        onLongPress={() => handleChannelLongPress(item)}
        activeOpacity={0.7}
      >
        {item.avatar ? (
          <Image
            source={{ uri: item.avatar }}
            style={styles.channelAvatar}
            onError={(e) =>
              console.log("Ошибка загрузки изображения:", e.nativeEvent.error)
            }
          />
        ) : (
          <View style={[styles.channelAvatarPlaceholder, { backgroundColor: isDarkMode ? "rgba(124, 92, 255, 0.3)" : "#7C5CFF" }]}>
            <Text style={styles.channelAvatarText}>{item.name[0]}</Text>
          </View>
        )}
        <View style={styles.channelInfo}>
          <View style={styles.channelHeader}>
            <Text
              style={[
                styles.channelName,
                {
                  color: isDarkMode ? "#fff" : "#1E293B",
                  fontWeight: unreadCount > 0 ? "700" : "600",
                  flex: 1,
                },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {isPinned && (
                <MaterialCommunityIcons name="pin" size={13} color={isDarkMode ? "rgba(124, 92, 255, 0.8)" : "#7C5CFF"} style={{ marginRight: 4 }} />
              )}
              {item.lastMessageTime ? (
                <Text style={{ color: isDarkMode ? "rgba(255,255,255,0.35)" : "#94A3B8", fontSize: 12 }}>
                  {formatChannelTime(item.lastMessageTime)}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              {item.lastMessageIsForwarded && (
                <MaterialCommunityIcons name="share" size={13} color={isDarkMode ? "rgba(255,255,255,0.4)" : "#94A3B8"} style={{ marginRight: 3 }} />
              )}
              <Text
                style={[
                  styles.channelDescription,
                  { color: isDarkMode ? "rgba(255,255,255,0.4)" : "#94A3B8", flex: 1 },
                ]}
                numberOfLines={1}
              >
                {getChannelLastMessage(item)}
              </Text>
            </View>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            )}
          </View>
          {!item.isMember && item.ownerId != userId && (
            <TouchableOpacity
              onPress={() => joinChannel(item.id)}
              style={[
                styles.joinButton,
                { backgroundColor: isDarkMode ? "rgba(124, 92, 255, 0.3)" : "rgba(124, 92, 255, 0.1)" },
              ]}
            >
              <Text style={[styles.joinButtonText, { color: isDarkMode ? "#7C5CFF" : "#7C5CFF" }]}>Подписаться</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#0B0F19" : "#FFFFFF" },
      ]}
    >
      {isSelectionMode && (
        <View
          style={[
            styles.actions,
            {
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#F1F5F9",
              borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
            },
          ]}
        >
          <TouchableOpacity style={styles.actionBtn} onPress={selectAll} activeOpacity={0.7}>
            <MaterialCommunityIcons name="check-all" size={18} color={isDarkMode ? "#F5F7FA" : "#1E293B"} />
            <Text style={[styles.actionText, { color: isDarkMode ? "#F5F7FA" : "#1E293B" }]} numberOfLines={1}>Выбрать все</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={deselectAll} activeOpacity={0.7}>
            <MaterialCommunityIcons name="close" size={18} color={isDarkMode ? "#F5F7FA" : "#1E293B"} />
            <Text style={[styles.actionText, { color: isDarkMode ? "#F5F7FA" : "#1E293B" }]} numberOfLines={1}>Отменить</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={deleteSelectedChannels} activeOpacity={0.7}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF3B30" />
            <Text style={[styles.actionText, { color: "#FF3B30" }]} numberOfLines={1}>Удалить</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowPinMenu(true)}
            disabled={selectedChannels.length === 0}
            style={styles.actionIconBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="dots-vertical" size={20} color={isDarkMode ? "#F5F7FA" : "#1E293B"} />
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <Text style={[styles.emptyText, { color: isDarkMode ? "#FF6B6B" : "#FF0000" }]}>
          {error}
        </Text>
      )}

      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.5)" },
          ]}
        >
          <FontAwesome name="search" size={16} color={isDarkMode ? "rgba(255,255,255,0.4)" : "#94A3B8"} />
          <TextInput
            style={[styles.searchInput, { color: isDarkMode ? "#F5F7FA" : "#1E293B" }]}
            placeholder="Поиск по каналам..."
            placeholderTextColor={isDarkMode ? "rgba(255,255,255,0.3)" : "#94A3B8"}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      <FlatList
        data={[...channels].sort((a, b) => {
          const aPin = pinnedChannels.includes(a.id) ? 1 : 0;
          const bPin = pinnedChannels.includes(b.id) ? 1 : 0;
          return bPin - aPin;
        })}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderChannelItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyList}
        refreshing={isLoading}
        onRefresh={() => {
          const currentUserId = getUserId();
          if (currentUserId) {
            fetchChannels(currentUserId);
            fetchUnreadCounts(currentUserId);
          }
        }}
      />

      <Modal
        visible={showPinMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPinMenu(false)}
      >
        <Pressable style={menuStyles.overlay} onPress={() => setShowPinMenu(false)}>
          <View style={[menuStyles.sheet, { backgroundColor: isDarkMode ? '#121826' : '#FFFFFF' }]}>
            <Text style={[menuStyles.title, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
              Выбрано: {selectedChannels.length}
            </Text>
            <TouchableOpacity style={menuStyles.item} onPress={handlePinSelected}>
              <MaterialCommunityIcons
                name={selectedChannels.every(id => pinnedChannels.includes(id)) ? "pin-off" : "pin"}
                size={20}
                color={isDarkMode ? '#AD94FF' : '#5B3FE0'}
              />
              <Text style={[menuStyles.itemText, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
                {selectedChannels.every(id => pinnedChannels.includes(id)) ? "Открепить" : "Закрепить"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[menuStyles.item, menuStyles.cancel]} onPress={() => setShowPinMenu(false)}>
              <Text style={[menuStyles.itemText, { color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8' }]}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    height: 46,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: 46,
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  channelCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  channelAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
  },
  channelAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  channelAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  channelInfo: {
    flex: 1,
  },
  channelHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  channelName: {
    fontSize: 16,
    flex: 1,
  },
  channelDescription: {
    fontSize: 14,
  },
  hintText: {
    marginTop: 4,
    fontSize: 12,
  },
  joinButton: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  joinButtonText: {
    fontWeight: "600",
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 7,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  actionIconBtn: {
    flexShrink: 0,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    marginRight: 5,
  },
  unreadBadge: {
    backgroundColor: "#7C5CFF",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    paddingHorizontal: 5,
  },
});

const menuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 10,
    opacity: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  itemText: {
    fontSize: 16,
  },
  cancel: {
    justifyContent: 'center',
    marginTop: 8,
  },
});

export default ChannelsListScreen;