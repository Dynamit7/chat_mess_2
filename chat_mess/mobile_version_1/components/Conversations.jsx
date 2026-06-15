import React, { useState, useEffect, useRef } from "react";
import emitter from "../screens/eventEmitter";
import {
  ScrollView,
  View,
  StyleSheet,
  TextInput,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import ConversationItem from "./ConversationItem";
import { useTheme } from "../ThemeContext";
import socket from "../src/socket";
import { BASE_URL } from "../src/config";

export default function Conversations() {
  const { isDarkMode } = useTheme();

  const [currentUserId, setCurrentUserId] = useState(null);
  const [requestsSent, setRequestsSent] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [chats, setChats] = useState([]);
  const [pinnedChats, setPinnedChats] = useState([]);
  const [showPinMenu, setShowPinMenu] = useState(false);
  const [selectedChats, setSelectedChats] = useState([]);

  // Emit total unread count whenever chats change
  useEffect(() => {
    const total = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    emitter.emit('totalUnread', total);
  }, [chats]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [nicknameQuery, setNicknameQuery] = useState("");
  const [foundUsers, setFoundUsers] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem("userId").then(async (id) => {
      if (id) {
        setCurrentUserId(Number(id));
        socket.emit("joinRoom", `user_${id}`);
        const stored = await AsyncStorage.getItem(`@pinnedChats_${id}`);
        if (stored) setPinnedChats(JSON.parse(stored));
      }
    });
  }, []);

  // Re-join personal room after socket reconnect so chatUpdated events keep working
  useEffect(() => {
    if (!currentUserId) return;
    const handleReconnect = () => {
      socket.emit("registerUser", { userId: currentUserId });
      socket.emit("joinRoom", `user_${currentUserId}`);
      console.log(`Conversations: re-joined user_${currentUserId} after reconnect`);
    };
    socket.on("connect", handleReconnect);
    return () => socket.off("connect", handleReconnect);
  }, [currentUserId]);

  useEffect(() => {
    const handleMessagesRead = async ({ readerId, partnerId, unreadCount }) => {
      const storedGhostMode = await AsyncStorage.getItem("ghostMode");
      const ghostMode = storedGhostMode ? JSON.parse(storedGhostMode) : false;

      if (Number(readerId) === Number(currentUserId) && !ghostMode) {
        setChats((prevChats) => {
          const updatedChats = prevChats.map((chat) =>
            Number(chat.partnerId) === Number(partnerId)
              ? { ...chat, unreadCount: unreadCount || 0 }
              : chat
          );
          AsyncStorage.setItem("chats", JSON.stringify(updatedChats)).catch((err) =>
            console.log("Error saving chats:", err)
          );
          return updatedChats;
        });
      }
    };

    socket.on("messagesReadByRecipient", handleMessagesRead);
    return () => {
      socket.off("messagesReadByRecipient", handleMessagesRead);
    };
  }, [currentUserId]);

  useEffect(() => {
    const loadChats = async () => {
      if (!currentUserId) return;

      // Show cached chats immediately so the screen isn't blank during fetch
      const storedChats = await AsyncStorage.getItem("chats");
      if (storedChats) {
        try {
          const parsedChats = JSON.parse(storedChats);
          const normalizedCached = parsedChats.map((chat) => ({
            ...chat,
            username: chat.username || "Unknown User",
            lastMessage: chat.lastMessage && typeof chat.lastMessage === "string"
              ? chat.lastMessage.trim()
              : "",
          }));
          setChats(normalizedCached);
        } catch (_) {}
      }

      try {
        const res = await fetch(`${BASE_URL}/api/messages/getChats?userId=${currentUserId}`);
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const serverChats = await res.json();

        if (!Array.isArray(serverChats)) {
          throw new Error("Invalid response from server");
        }

        const normalizedChats = serverChats.map((chat) => ({
          ...chat,
          username: chat.username || "Unknown User",
          lastMessage: chat.lastMessage && typeof chat.lastMessage === "string"
            ? chat.lastMessage.trim()
            : "",
        }));

        setChats(normalizedChats);
        await AsyncStorage.setItem("chats", JSON.stringify(normalizedChats));
      } catch (error) {
        console.error("Error loading chats:", error);
        // Cached chats were already shown above — nothing more to do
      }
    };

    loadChats();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    const handleChatUpdated = (newChat) => {
      let normalizedLastMessage = "";
      let lastMessageType = "text";
      let isForwarded = false;
      if (newChat.lastMessage) {
        if (typeof newChat.lastMessage === "string") {
          normalizedLastMessage = newChat.lastMessage.trim().replace(/[\x00-\x1F\x7F]/g, '');
        } else if (typeof newChat.lastMessage === "object") {
          if (newChat.lastMessage.text && typeof newChat.lastMessage.text === "string") {
            normalizedLastMessage = newChat.lastMessage.text.trim().replace(/[\x00-\x1F\x7F]/g, '');
          }
          lastMessageType = newChat.lastMessage.type || "text";
          isForwarded = !!newChat.lastMessage.forwardedFromType;
        }
      }

      setChats((prevChats) => {
        const existingIndex = prevChats.findIndex((chat) => Number(chat.partnerId) === Number(newChat.partnerId));
        const hasLastMessage = newChat.lastMessage !== undefined && newChat.lastMessage !== null;
        const newTime = newChat.lastMessage?.createdAt || newChat.lastMessage?.time || new Date().toISOString();

        let updatedChats;
        if (existingIndex === -1 && newChat.partnerInfo) {
          // Новый чат — добавляем в начало
          updatedChats = [
            {
              username: newChat.partnerInfo.username || newChat.partnerInfo.nickname || "Unknown User",
              bio: `Email: ${newChat.partnerInfo.email || "N/A"}`,
              lastMessage: normalizedLastMessage,
              lastMessageType,
              isForwarded,
              time: newTime,
              partnerId: newChat.partnerId,
              picture: newChat.partnerInfo.avatar || null,
              unreadCount: newChat.unreadCount || 0,
            },
            ...prevChats,
          ];
        } else if (existingIndex === -1) {
          // partnerInfo missing — skip
          updatedChats = prevChats;
        } else {
          // Существующий чат — обновляем и перемещаем в начало (или после закреплённых — сортировка сделает это)
          const existing = prevChats[existingIndex];
          const updated = {
            ...existing,
            lastMessage: hasLastMessage ? normalizedLastMessage : existing.lastMessage,
            lastMessageType: hasLastMessage ? lastMessageType : existing.lastMessageType,
            isForwarded: hasLastMessage ? isForwarded : existing.isForwarded,
            time: hasLastMessage ? newTime : existing.time,
            unreadCount: newChat.unreadCount !== undefined ? newChat.unreadCount : existing.unreadCount,
          };
          // Убираем чат со старого места и ставим в начало
          updatedChats = [updated, ...prevChats.filter((_, i) => i !== existingIndex)];
        }

        AsyncStorage.setItem("chats", JSON.stringify(updatedChats)).catch((err) =>
          console.log("Error saving chats:", err)
        );
        return updatedChats;
      });
    };

    socket.on("chatUpdated", handleChatUpdated);
    return () => {
      socket.off("chatUpdated", handleChatUpdated);
    };
  }, [currentUserId]);

  useEffect(() => {
    const syncUnreadCounts = async () => {
      if (!currentUserId) return;
      try {
        const response = await fetch(
          `${BASE_URL}/api/messages/unreadCounts?userId=${currentUserId}`
        );
        if (!response.ok) return;
        const unreadCounts = await response.json();
        setChats((prevChats) => {
          const updated = prevChats.map((chat) => ({
            ...chat,
            unreadCount: unreadCounts[chat.partnerId] ?? chat.unreadCount ?? 0,
          }));
          // Save updated (not stale closure) data
          AsyncStorage.setItem("chats", JSON.stringify(updated)).catch((err) =>
            console.log("Error saving chats:", err)
          );
          return updated;
        });
      } catch (err) {
        console.error("Error syncing unread counts:", err);
      }
    };
    syncUnreadCounts();
  }, [currentUserId]);

  useEffect(() => {
    const handleProfileUpdated = (data) => {
      setChats((prevChats) => {
        const updatedChats = prevChats.map((chat) => {
          if (Number(chat.partnerId) === Number(data.userId)) {
            return {
              ...chat,
              username: data.username,
              picture: data.avatar || null,
            };
          }
          return chat;
        });
        AsyncStorage.setItem("chats", JSON.stringify(updatedChats));
        return updatedChats;
      });
    };

    socket.on("profileUpdated", handleProfileUpdated);
    return () => {
      socket.off("profileUpdated", handleProfileUpdated);
    };
  }, []);

  const fetchUserDisplayName = async (userId) => {
    try {
      const response = await fetch(`${BASE_URL}/api/users/${userId}`);
      if (!response.ok) throw new Error("Failed to get user");
      const user = await response.json();
      return user.username || user.nickname || null;
    } catch (error) {
      console.error("Error fetching user:", error);
      return null;
    }
  };

  useEffect(() => {
    const onFriendRequestReceived = async (request) => {
      const senderName =
        (await fetchUserDisplayName(request.fromUserId)) ||
        `User #${request.fromUserId}`;
      const enrichedRequest = { ...request, senderName };
      setFriendRequests((prev) => [...prev, enrichedRequest]);
    };
    socket.on("friendRequestReceived", onFriendRequestReceived);
    return () => {
      socket.off("friendRequestReceived", onFriendRequestReceived);
    };
  }, []);

  useEffect(() => {
    const onFriendRequestAccepted = (data) => {
      if (!data || !data.partnerId || !data.partnerInfo) return;
      const newChat = {
        username: data.partnerInfo.username || data.partnerInfo.nickname,
        bio: `Email: ${data.partnerInfo.email}`,
        lastMessage: "",
        time: "",
        partnerId: data.partnerId,
        picture: data.partnerInfo.avatar || null,
        unreadCount: 0,
      };
      setChats((prevChats) => {
        const chatExists = prevChats.some(
          (chat) => chat.partnerId === newChat.partnerId
        );
        if (!chatExists) {
          const updatedChats = [newChat, ...prevChats];
          AsyncStorage.setItem("chats", JSON.stringify(updatedChats));
          return updatedChats;
        }
        return prevChats;
      });
    };
    socket.on("friendRequestAccepted", onFriendRequestAccepted);
    return () => {
      socket.off("friendRequestAccepted", onFriendRequestAccepted);
    };
  }, []);

  useEffect(() => {
    if (nicknameQuery.startsWith("@")) {
      const searchValue = nicknameQuery.slice(1);
      if (searchValue.length > 0) {
        searchUsersByNickname(searchValue);
      } else {
        setFoundUsers([]);
      }
    } else {
      setFoundUsers([]);
    }
  }, [nicknameQuery]);

  useEffect(() => {
    if (!currentUserId) return;

    const handleLastMessageUpdated = ({ partnerId, lastMessage, time }) => {
      let normalizedLastMessage = "";
      if (lastMessage && typeof lastMessage === "string") {
        normalizedLastMessage = lastMessage.trim();
      }

      setChats((prevChats) => {
        const idx = prevChats.findIndex((c) => Number(c.partnerId) === Number(partnerId));
        if (idx === -1) return prevChats;
        const updated = {
          ...prevChats[idx],
          lastMessage: normalizedLastMessage,
          time: time || prevChats[idx].time || new Date().toISOString(),
        };
        const updatedChats = [updated, ...prevChats.filter((_, i) => i !== idx)];
        AsyncStorage.setItem("chats", JSON.stringify(updatedChats)).catch((err) =>
          console.log("Error saving chats:", err)
        );
        return updatedChats;
      });
    };

    socket.on("lastMessageUpdated", handleLastMessageUpdated);

    return () => {
      socket.off("lastMessageUpdated", handleLastMessageUpdated);
    };
  }, [currentUserId]);

  const searchUsersByNickname = async (nickname) => {
    try {
      const response = await fetch(
        `${BASE_URL}/api/users/search?nickname=${nickname}&requesterId=${currentUserId}`
      );
      const users = await response.json();
      setFoundUsers(users);
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  const handleAddFriend = async (user) => {
    if (!currentUserId) return;
    socket.emit("sendRequestToFriend", {
      fromUserId: currentUserId,
      toUserId: user.id,
    });
    setRequestsSent((prev) => [...prev, user.id]);
    setNicknameQuery("");
    setFoundUsers([]);
    setShowUserSearch(false);
  };

  const acceptFriendRequest = (request) => {
    setFriendRequests(friendRequests.filter((req) => req.fromUserId !== request.fromUserId));
    socket.emit("acceptFriendRequest", request);
  };

  const handleToggleUserSearch = () => {
    setShowUserSearch(!showUserSearch);
    setNicknameQuery("");
    setFoundUsers([]);
  };

  const handlePinSelected = async () => {
    const selectedPartnerIds = chats
      .filter(chat => selectedChats.includes(chat.username))
      .map(chat => chat.partnerId);
    const allPinned = selectedPartnerIds.every(id => pinnedChats.includes(id));
    const updated = allPinned
      ? pinnedChats.filter(id => !selectedPartnerIds.includes(id))
      : [...pinnedChats, ...selectedPartnerIds.filter(id => !pinnedChats.includes(id))];
    setPinnedChats(updated);
    await AsyncStorage.setItem(`@pinnedChats_${currentUserId}`, JSON.stringify(updated));
    setShowPinMenu(false);
  };

  const filteredChats = chats
    .filter((chat) => (chat.username || "").toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aPin = pinnedChats.includes(a.partnerId) ? 1 : 0;
      const bPin = pinnedChats.includes(b.partnerId) ? 1 : 0;
      if (bPin !== aPin) return bPin - aPin; // закреплённые всегда сверху
      // внутри группы — сортируем по времени последнего сообщения (новые сверху)
      const aTime = a.time ? new Date(a.time).getTime() : 0;
      const bTime = b.time ? new Date(b.time).getTime() : 0;
      return bTime - aTime;
    });

  const selectAll = () => {
    const allUsernames = chats.map((chat) => chat.username);
    setSelectedChats(allUsernames);
    setIsSelectionMode(true);
  };

  const deselectAll = () => {
    setSelectedChats([]);
    setIsSelectionMode(false);
  };

  const deleteSelectedChats = async () => {
    try {
      const partnerIds = chats
        .filter((chat) => selectedChats.includes(chat.username))
        .map((chat) => chat.partnerId);

      if (partnerIds.length === 0) return;

      const response = await fetch(`${BASE_URL}/api/messages/deleteChats`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, partnerIds }),
      });

      const data = await response.json();

      if (data.success) {
        const updatedChats = chats.filter(
          (chat) => !partnerIds.includes(chat.partnerId)
        );
        setChats(updatedChats);
        setSelectedChats([]);
        setIsSelectionMode(false);
        await AsyncStorage.setItem("chats", JSON.stringify(updatedChats));
      }
    } catch (err) {
      console.error("Error deleting chats:", err);
    }
  };

  useEffect(() => {
    const handleChatsDeleted = ({ partnerIds }) => {
      setChats((prevChats) => {
        const updatedChats = prevChats.filter(
          (chat) => !partnerIds.includes(chat.partnerId)
        );
        AsyncStorage.setItem("chats", JSON.stringify(updatedChats)).catch((err) =>
          console.log("Error saving chats:", err)
        );
        return updatedChats;
      });
      setSelectedChats([]);
      setIsSelectionMode(false);
    };

    socket.on("chatsDeleted", handleChatsDeleted);
    return () => {
      socket.off("chatsDeleted", handleChatsDeleted);
    };
  }, []);

  const handleChatOpened = async (partnerId) => {
    try {
      const storedGhostMode = await AsyncStorage.getItem("ghostMode");
      const ghostMode = storedGhostMode ? JSON.parse(storedGhostMode) : false;

      if (!ghostMode) {
        const response = await fetch(`${BASE_URL}/api/messages/markAsRead`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentUserId, partnerId }),
        });
        const data = await response.json();

        setChats((prevChats) => {
          const updatedChats = prevChats.map((chat) =>
            Number(chat.partnerId) === Number(partnerId)
              ? { ...chat, unreadCount: data.unreadCount }
              : chat
          );
          AsyncStorage.setItem("chats", JSON.stringify(updatedChats)).catch((err) =>
            console.log("Error saving chats:", err)
          );
          return updatedChats;
        });

        if (data.success) {
          socket.emit("messagesRead", { readerId: currentUserId, partnerId, unreadCount: 0 });
        }
      }
    } catch (err) {
      console.error("Error in handleChatOpened:", err);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? "#0B0F19" : "#FFFFFF" }]}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[
          styles.searchBar,
          { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)' }
        ]}>
          <Icon name="magnify" size={20} color={isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          <TextInput
            style={[styles.searchInput, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}
            placeholder="Search chats..."
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.bellButton,
            { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)' }
          ]}
          onPress={() => setShowRequests(!showRequests)}
        >
          <Icon name="bell-outline" size={20} color={isDarkMode ? 'rgba(255,255,255,0.7)' : '#64748B'} />
          {friendRequests.length > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{friendRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Friend Requests Panel */}
      {showRequests && (
        <View style={[
          styles.requestsPanel,
          { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }
        ]}>
          <Text style={[styles.requestsTitle, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
            Friend Requests
          </Text>
          {friendRequests.length === 0 ? (
            <Text style={[styles.noRequestsText, { color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8' }]}>
              No requests
            </Text>
          ) : (
            friendRequests.map((request, index) => (
              <View key={index} style={styles.requestRow}>
                <View style={styles.requestInfo}>
                  <LinearGradient
                    colors={['#7C5CFF', '#00C2FF']}
                    style={styles.requestAvatar}
                  >
                    <Text style={styles.requestAvatarText}>
                      {(request.senderName?.[0] || '?').toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <Text style={[styles.requestName, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]} numberOfLines={1}>
                    {request.senderName || `User #${request.fromUserId}`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => acceptFriendRequest(request)}
                >
                  <LinearGradient
                    colors={['#4ADE80', '#22C55E']}
                    style={styles.acceptGradient}
                  >
                    <Icon name="check" size={16} color="#fff" />
                    <Text style={styles.acceptText}>Accept</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {/* User Search Panel */}
      {showUserSearch && (
        <View style={[
          styles.userSearchPanel,
          { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }
        ]}>
          <View style={[
            styles.userSearchInputWrapper,
            { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)' }
          ]}>
            <Icon name="at" size={18} color={isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
            <TextInput
              style={[styles.userSearchInput, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}
              placeholder="Type @nickname..."
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
              value={nicknameQuery}
              onChangeText={setNicknameQuery}
            />
          </View>
          {foundUsers.length > 0 && foundUsers.map((user) => {
            const alreadyExists = chats.some((chat) => chat.partnerId === user.id);
            const isRequestSent = requestsSent.includes(user.id);
            return (
              <View key={user.id} style={styles.foundUserRow}>
                <Text style={[styles.foundUserName, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]} numberOfLines={1}>
                  {user.nickname ? `@${user.nickname}` : user.email}
                </Text>
                <TouchableOpacity
                  disabled={alreadyExists || isRequestSent}
                  onPress={() => handleAddFriend(user)}
                >
                  <LinearGradient
                    colors={alreadyExists || isRequestSent
                      ? [isDarkMode ? '#374151' : '#CBD5E1', isDarkMode ? '#374151' : '#CBD5E1']
                      : ['#7C5CFF', '#5B3FE0']
                    }
                    style={styles.addFriendBtn}
                  >
                    <Text style={styles.addFriendText}>
                      {alreadyExists ? "Friends" : isRequestSent ? "Sent" : "Add"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Selection Mode Actions */}
      {isSelectionMode && (
        <View style={[
          styles.selectionBar,
          { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F8FAFC' }
        ]}>
          <TouchableOpacity style={styles.selectionAction} onPress={selectAll}>
            <Icon name="check-all" size={18} color={isDarkMode ? '#F5F7FA' : '#64748B'} />
            <Text style={[styles.selectionText, { color: isDarkMode ? '#F5F7FA' : '#64748B' }]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectionAction} onPress={deselectAll}>
            <Icon name="close" size={18} color={isDarkMode ? '#F5F7FA' : '#64748B'} />
            <Text style={[styles.selectionText, { color: isDarkMode ? '#F5F7FA' : '#64748B' }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectionAction} onPress={deleteSelectedChats}>
            <Icon name="trash-can-outline" size={18} color="#EF4444" />
            <Text style={[styles.selectionText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectionAction} onPress={() => setShowPinMenu(true)} disabled={selectedChats.length === 0}>
            <Icon name="dots-vertical" size={20} color={isDarkMode ? '#F5F7FA' : '#64748B'} />
          </TouchableOpacity>
        </View>
      )}

      {/* Chat List */}
      {filteredChats.length > 0 ? (
        <ScrollView contentContainerStyle={styles.chatList}>
          {filteredChats.map((chat, index) => (
            <ConversationItem
              key={index}
              id={chat.partnerId}
              username={chat.username}
              bio={chat.bio}
              picture={chat.picture}
              lastMessage={chat.lastMessage}
              lastMessageType={chat.lastMessageType}
              isForwarded={chat.isForwarded}
              time={chat.time}
              notification={chat.notification}
              selectedChats={selectedChats}
              setSelectedChats={setSelectedChats}
              isSelectionMode={isSelectionMode}
              setIsSelectionMode={setIsSelectionMode}
              unreadCount={chat.unreadCount || 0}
              onChatOpened={handleChatOpened}
              isPinned={pinnedChats.includes(chat.partnerId)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Icon name="chat-outline" size={48} color={isDarkMode ? 'rgba(255,255,255,0.15)' : '#CBD5E1'} />
          <Text style={[styles.emptyText, { color: isDarkMode ? 'rgba(255,255,255,0.3)' : '#94A3B8' }]}>
            No conversations yet
          </Text>
        </View>
      )}

      {/* Pin Menu Modal */}
      <Modal
        visible={showPinMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPinMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowPinMenu(false)}>
          <View style={[styles.menuSheet, { backgroundColor: isDarkMode ? '#121826' : '#FFFFFF' }]}>
            <Text style={[styles.menuTitle, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
              Выбрано: {selectedChats.length}
            </Text>
            <TouchableOpacity style={styles.menuItem} onPress={handlePinSelected}>
              <Icon
                name={
                  chats.filter(c => selectedChats.includes(c.username)).every(c => pinnedChats.includes(c.partnerId))
                    ? "pin-off" : "pin"
                }
                size={20}
                color={isDarkMode ? '#AD94FF' : '#5B3FE0'}
              />
              <Text style={[styles.menuItemText, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
                {chats.filter(c => selectedChats.includes(c.username)).every(c => pinnedChats.includes(c.partnerId))
                  ? "Открепить" : "Закрепить"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuCancel]} onPress={() => setShowPinMenu(false)}>
              <Text style={[styles.menuItemText, { color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8' }]}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* FAB */}
      <TouchableOpacity style={styles.fabButton} onPress={handleToggleUserSearch} activeOpacity={0.85}>
        <LinearGradient
          colors={['#7C5CFF', '#5B3FE0']}
          style={styles.fabGradient}
        >
          <Icon name="account-plus" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    height: 44,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: 44,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  requestsPanel: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  requestsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  noRequestsText: {
    fontSize: 14,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  requestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  requestAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  requestName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  acceptButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 4,
  },
  acceptText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  userSearchPanel: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  userSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  userSearchInput: {
    flex: 1,
    fontSize: 15,
    height: 42,
  },
  foundUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  foundUserName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  addFriendBtn: {
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  addFriendText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  selectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  selectionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chatList: {
    paddingBottom: 90,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  fabButton: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 10,
    opacity: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  menuItemText: {
    fontSize: 16,
  },
  menuCancel: {
    justifyContent: 'center',
    marginTop: 8,
  },
});
