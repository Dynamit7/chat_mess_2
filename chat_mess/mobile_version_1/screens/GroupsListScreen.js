import { useState, useEffect, useRef, useCallback } from "react"
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Image, Alert, Modal, Pressable, Platform } from "react-native"
import axios from "axios"
import io from "socket.io-client"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"
import { useTheme } from "../ThemeContext"
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons"
import { BASE_URL } from "../src/config";
import emitter from "./eventEmitter";

// const BASE_URL = Platform.select({ web: 'http://192.168.77.41:3000', default: 'http://192.168.77.41:3000' });

function GroupsListScreen({ navigation }) {
  const [groups, setGroups] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [userId, setUserId] = useState(null)
  const [unreadCounts, setUnreadCounts] = useState({})

  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, c) => sum + (c || 0), 0);
    emitter.emit('totalUnreadGroups', total);
  }, [unreadCounts]);
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedGroups, setSelectedGroups] = useState([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [pinnedGroups, setPinnedGroups] = useState([])
  const [showPinMenu, setShowPinMenu] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState(null)
  const processedMessagesRef = useRef(new Set()) // Для дедупликации событий
  
  const socketRef = useRef(null)
  const { isDarkMode } = useTheme()

  const getUserId = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem("userId")
      if (storedUserId && storedUserId !== "null" && !isNaN(Number(storedUserId))) {
        const userIdNum = Number(storedUserId)
        setUserId(userIdNum)
        const storedPinned = await AsyncStorage.getItem(`@pinnedGroups_${userIdNum}`)
        if (storedPinned) setPinnedGroups(JSON.parse(storedPinned))
        return userIdNum
      }
      return null
    } catch (err) {
      console.error("Ошибка при получении userId:", err)
      setError("Ошибка загрузки данных пользователя")
      return null
    }
  }

  const togglePinGroup = async (group) => {
    const isPinned = pinnedGroups.includes(group.id)
    const updated = isPinned
      ? pinnedGroups.filter((p) => p !== group.id)
      : [...pinnedGroups, group.id]
    setPinnedGroups(updated)
    await AsyncStorage.setItem(`@pinnedGroups_${userId}`, JSON.stringify(updated))
  }

  const fetchGroups = async (givenUserId) => {
    setIsLoading(true)
    setError(null)
    try {
      const uid = givenUserId || userId
      if (!uid || uid === "null") {
        setIsLoading(false)
        return
      }
      const response = await axios.get(`${BASE_URL}/api/groups?search=${searchTerm}&userId=${uid}`)
      console.log('Groups API response:', response.data)
      const validGroups = response.data.filter(item => item && item.id !== undefined && item.id !== null)
      if (validGroups.length < response.data.length) {
        console.warn('Filtered out invalid groups:', response.data.filter(item => !item || item.id === undefined || item.id === null))
      }
      setGroups(validGroups)
    } catch (err) {
      console.error("Ошибка при получении списка групп:", err)
      setError("Ошибка загрузки групп")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUnreadCounts = async (uid) => {
    try {
      const userIdToFetch = uid || userId
      if (!userIdToFetch || userIdToFetch === "null" || isNaN(Number(userIdToFetch))) {
        console.log("Неверный userId, пропускаем загрузку непрочитанных")
        return
      }
      const response = await axios.get(`${BASE_URL}/api/groups/${userIdToFetch}/unread-counts`)
      const counts = {}
      response.data.forEach((item) => {
        counts[item.groupId] = item.unreadCount
      })
      setUnreadCounts(counts)
    } catch (err) {
      console.error("Ошибка при загрузке непрочитанных сообщений:", err)
    }
  }

  const handleSearch = () => {
    fetchGroups()
  }

  const joinGroup = async (groupId) => {
    try {
      const currentUserId = await getUserId()
      if (!currentUserId) {
        Alert.alert("Ошибка", "Не удалось определить пользователя")
        return
      }
      await axios.post(`${BASE_URL}/api/groups/${groupId}/join`, {
        userId: currentUserId,
      })
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, isMember: true } : g)))
      setUnreadCounts((prev) => ({ ...prev, [groupId]: 0 }))
      setActiveGroupId(groupId)
      navigation.navigate("GroupChatScreen", { groupId })
    } catch (err) {
      console.error("Ошибка при вступлении в группу:", err)
      Alert.alert("Ошибка", "Не удалось присоединиться к группе")
    }
  }

  const handleGroupPress = (group) => {
    if (isSelectionMode) {
      setSelectedGroups((prevSelected) => {
        const newSelected = prevSelected.includes(group.id)
          ? prevSelected.filter((id) => id !== group.id)
          : [...prevSelected, group.id]
        if (newSelected.length === 0) {
          setIsSelectionMode(false)
        }
        return newSelected
      })
    } else {
      if (group.isMember || group.ownerId == userId) {
        setUnreadCounts((prev) => ({ ...prev, [group.id]: 0 }))
        setActiveGroupId(group.id)
        navigation.navigate("GroupChatScreen", { groupId: group.id })
      } else {
        joinGroup(group.id)
      }
    }
  }

  const handleGroupLongPress = (group) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true)
      setSelectedGroups([group.id])
    } else {
      setSelectedGroups((prevSelected) => {
        const newSelected = prevSelected.includes(group.id)
          ? prevSelected.filter((id) => id !== group.id)
          : [...prevSelected, group.id]
        if (newSelected.length === 0) setIsSelectionMode(false)
        return newSelected
      })
    }
  }

  const handlePinSelected = async () => {
    const allPinned = selectedGroups.every(id => pinnedGroups.includes(id))
    const updated = allPinned
      ? pinnedGroups.filter(id => !selectedGroups.includes(id))
      : [...pinnedGroups, ...selectedGroups.filter(id => !pinnedGroups.includes(id))]
    setPinnedGroups(updated)
    await AsyncStorage.setItem(`@pinnedGroups_${userId}`, JSON.stringify(updated))
    setShowPinMenu(false)
  }

  const selectAll = () => {
    const allIds = groups.map((g) => g.id)
    setSelectedGroups(allIds)
  }

  const deselectAll = () => {
    setSelectedGroups([])
    setIsSelectionMode(false)
  }

  const deleteSelectedGroups = async () => {
    if (selectedGroups.length === 0) {
      setIsSelectionMode(false)
      return
    }
    try {
      const currentUserId = await getUserId()
      if (!currentUserId) {
        Alert.alert("Ошибка", "Не удалось определить пользователя")
        return
      }
      const newGroupList = [...groups]
      const newUnreadCounts = { ...unreadCounts }
      for (const groupId of selectedGroups) {
        const group = groups.find((g) => g.id === groupId)
        if (!group) continue
        try {
          if (String(group.ownerId) === String(currentUserId)) {
            await axios.delete(`${BASE_URL}/api/groups/${groupId}`, {
              data: { userId: currentUserId },
            })
            const index = newGroupList.findIndex((g) => g.id === groupId)
            if (index !== -1) newGroupList.splice(index, 1)
            delete newUnreadCounts[groupId]
          } else if (group.isMember) {
            await axios.delete(`${BASE_URL}/api/groups/${groupId}/leave`, {
              data: { userId: currentUserId },
            })
            const index = newGroupList.findIndex((g) => g.id === groupId)
            if (index !== -1) newGroupList.splice(index, 1)
            delete newUnreadCounts[groupId]
          }
        } catch (err) {
          console.error(`Ошибка при работе с группой ${groupId}:`, err)
        }
      }
      setGroups(newGroupList)
      setUnreadCounts(newUnreadCounts)
      setSelectedGroups([])
      setIsSelectionMode(false)
    } catch (err) {
      console.error("Ошибка при удалении групп:", err)
      Alert.alert("Ошибка", "Не удалось удалить выбранные группы")
    }
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("state", (e) => {
      const currentRoute = e.data.state.routes[e.data.state.index]
      if (currentRoute.name !== "GroupChatScreen") {
        setActiveGroupId(null)
      }
    })
    return unsubscribe
  }, [navigation])

  useEffect(() => {
    let socket = null;
    const initializeSocket = async () => {
      const currentUserId = await getUserId()
      if (!currentUserId) return

      const token = await AsyncStorage.getItem("token");
      socket = io(`${BASE_URL}`, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ["websocket"],
        auth: { token: token || undefined },
      })
      socketRef.current = socket

      socket.emit("joinRoom", `user_${currentUserId}`)
      console.log(`Socket connected for user ${currentUserId}`);

      socket.on("connect", () => {
        console.log(`Socket reconnected for user ${currentUserId}`);
        socket.emit("joinRoom", `user_${currentUserId}`);
      });

      socket.on("groupCreated", (newGroup) => {
        if (
          newGroup.ownerId == currentUserId ||
          (Array.isArray(newGroup.members) && newGroup.members.includes(Number(currentUserId)))
        ) {
          fetchGroups(currentUserId)
          fetchUnreadCounts(currentUserId)
        }
      })

      socket.on("groupAdded", (data) => {
        if (data.groupId) {
          fetchGroups(currentUserId)
          fetchUnreadCounts(currentUserId)
        }
      })

      socket.on("groupRemoved", (data) => {
        if (data.groupId) {
          fetchGroups(currentUserId)
          fetchUnreadCounts(currentUserId)
        }
      })

      socket.on("newGroupMessage", ({ groupId, senderId, messageId, lastMessage, lastMessageType, lastMessageSender, lastMessageTime, lastMessageIsForwarded, unreadCount }) => {
        // Обновляем lastMessage для всех
        if (lastMessage !== undefined) {
          setGroups((prev) => prev.map((g) => {
            if (Number(g.id) === Number(groupId)) {
              if (lastMessage === null) {
                return { ...g, lastMessage: null, lastMessageType: null, lastMessageSender: null, lastMessageTime: null, lastMessageIsForwarded: false }
              }
              return { ...g, lastMessage, lastMessageType: lastMessageType || "text", lastMessageSender: lastMessageSender || "", lastMessageTime: lastMessageTime || "", lastMessageIsForwarded: !!lastMessageIsForwarded }
            }
            return g
          }))
        }

        // Если сервер прислал точный счётчик (после удаления) — применяем сразу
        if (unreadCount !== undefined) {
          setUnreadCounts((prev) => ({ ...prev, [groupId]: unreadCount }))
          return
        }

        // Иначе — логика инкремента для нового сообщения
        if (!currentUserId || senderId === currentUserId || activeGroupId === groupId) {
          return
        }
        if (processedMessagesRef.current.has(messageId)) {
          return;
        }
        processedMessagesRef.current.add(messageId);
        setUnreadCounts((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] || 0) + 1,
        }))
        if (processedMessagesRef.current.size > 1000) {
          processedMessagesRef.current.clear();
        }
      })

      socket.on("updateLastSeen", ({ groupId, userId: emitterUserId }) => {
        if (Number(emitterUserId) === Number(currentUserId)) {
          setUnreadCounts((prev) => ({
            ...prev,
            [groupId]: 0,
          }))
          fetchUnreadCounts(currentUserId)
        }
      })

      fetchUnreadCounts(currentUserId)
    }

    initializeSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        console.log('Socket disconnected')
      }
      processedMessagesRef.current.clear();
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const currentUserId = await getUserId()
        if (currentUserId) {
          fetchGroups(currentUserId)
          fetchUnreadCounts(currentUserId)
        }
      }
      loadData()
    }, [searchTerm]),
  )

  const messageTypeLabels = {
    image: "Фото", video: "Видео", file: "Файл",
    voice: "Голосовое", audio: "Аудио", sticker: "Стикер",
  }

  const formatGroupTime = (timeStr) => {
    if (!timeStr) return ""
    try {
      const date = new Date(timeStr)
      if (isNaN(date.getTime())) return ""
      const now = new Date()
      const diffMs = now - date
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      if (diffDays === 1) return "Вчера"
      if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" })
      return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" })
    } catch { return "" }
  }

  const getGroupLastMessage = (item) => {
    if (!item.lastMessage && !item.lastMessageType) return item.description || "Нет описания"
    const type = item.lastMessageType
    const text = item.lastMessage || ""
    const sender = item.lastMessageSender ? `${item.lastMessageSender}: ` : ""
    if (type && type !== "text" && messageTypeLabels[type]) {
      return `${sender}${messageTypeLabels[type]}`
    }
    const cleaned = text.replace(/[\x00-\x1F\x7F]/g, "").trim()
    if (!cleaned) return item.description || "Нет описания"
    const msg = `${sender}${cleaned}`
    return msg.length > 40 ? msg.substring(0, 38) + "..." : msg
  }

  const renderGroupItem = ({ item }) => {
    const isSelected = selectedGroups.includes(item.id)
    const unreadCount = unreadCounts[item.id] || 0
    const isActiveGroup = item.id === activeGroupId
    const isPinned = pinnedGroups.includes(item.id)

    return (
      <TouchableOpacity
        style={[
          styles.groupCard,
          isSelected && { backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
          { opacity: isActiveGroup ? 0.8 : 1 },
        ]}
        onPress={() => handleGroupPress(item)}
        onLongPress={() => handleGroupLongPress(item)}
        activeOpacity={0.7}
      >
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.groupAvatar} />
        ) : (
          <View style={[styles.groupAvatarPlaceholder, { backgroundColor: isDarkMode ? "rgba(124, 92, 255, 0.3)" : "#7C5CFF" }]}>
            <Text style={styles.groupAvatarText}>{item.name[0]}</Text>
          </View>
        )}

        <View style={styles.groupInfo}>
          <View style={styles.groupHeader}>
            <Text
              style={[
                styles.groupName,
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
                <Text style={{ color: isDarkMode ? "rgba(255,255,255,0.35)" : "#94A3B8", fontSize: 12, marginLeft: 0 }}>
                  {formatGroupTime(item.lastMessageTime)}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.groupLastMessageRow}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              {item.lastMessageIsForwarded && (
                <MaterialCommunityIcons name="share" size={13} color={isDarkMode ? "rgba(255,255,255,0.4)" : "#94A3B8"} style={{ marginRight: 3 }} />
              )}
              <Text style={[styles.groupDescription, { color: isDarkMode ? "rgba(255,255,255,0.4)" : "#94A3B8", flex: 1 }]} numberOfLines={1}>
                {getGroupLastMessage(item)}
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
              onPress={() => joinGroup(item.id)}
              style={[styles.joinButton, { backgroundColor: isDarkMode ? "rgba(124, 92, 255, 0.3)" : "rgba(124, 92, 255, 0.1)" }]}
            >
              <Text style={[styles.joinButtonText, { color: isDarkMode ? "#7C5CFF" : "#7C5CFF" }]}>Присоединиться</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <Text style={[styles.emptyText, { color: isDarkMode ? "#fff" : "#000" }]}>Загрузка...</Text>
      ) : error ? (
        <Text style={[styles.emptyText, { color: "#FF3B30" }]}>{error}</Text>
      ) : (
        <Text style={[styles.emptyText, { color: isDarkMode ? "#fff" : "#000" }]}>
          {searchTerm ? "Группы не найдены" : "У вас пока нет групп"}
        </Text>
      )}
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? "#0B0F19" : "#FFFFFF" }]}>

      {isSelectionMode && (
        <View style={[styles.actions, {
          backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "#F1F5F9",
          borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
        }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={selectAll} activeOpacity={0.7}>
            <MaterialCommunityIcons name="check-all" size={18} color={isDarkMode ? "#F5F7FA" : "#1E293B"} />
            <Text style={[styles.actionText, { color: isDarkMode ? "#F5F7FA" : "#1E293B" }]} numberOfLines={1}>Выбрать все</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={deselectAll} activeOpacity={0.7}>
            <MaterialCommunityIcons name="close" size={18} color={isDarkMode ? "#F5F7FA" : "#1E293B"} />
            <Text style={[styles.actionText, { color: isDarkMode ? "#F5F7FA" : "#1E293B" }]} numberOfLines={1}>Отменить</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={deleteSelectedGroups} activeOpacity={0.7}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF3B30" />
            <Text style={[styles.actionText, { color: "#FF3B30" }]} numberOfLines={1}>Удалить</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowPinMenu(true)}
            disabled={selectedGroups.length === 0}
            style={styles.actionIconBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="dots-vertical" size={20} color={isDarkMode ? "#F5F7FA" : "#1E293B"} />
          </TouchableOpacity>
        </View>
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
            placeholder="Поиск по группам..."
            placeholderTextColor={isDarkMode ? "rgba(255,255,255,0.3)" : "#94A3B8"}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
          />
        </View>
      </View>

      <FlatList
        data={[...groups].sort((a, b) => {
          const aPin = pinnedGroups.includes(a.id) ? 1 : 0
          const bPin = pinnedGroups.includes(b.id) ? 1 : 0
          return bPin - aPin
        })}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGroupItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyList}
        refreshing={isLoading}
        onRefresh={async () => {
          if (isLoading) return
          const currentUserId = await getUserId()
          if (currentUserId) {
            fetchGroups(currentUserId)
            fetchUnreadCounts(currentUserId)
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
              Выбрано: {selectedGroups.length}
            </Text>
            <TouchableOpacity style={menuStyles.item} onPress={handlePinSelected}>
              <MaterialCommunityIcons
                name={selectedGroups.every(id => pinnedGroups.includes(id)) ? "pin-off" : "pin"}
                size={20}
                color={isDarkMode ? '#AD94FF' : '#5B3FE0'}
              />
              <Text style={[menuStyles.itemText, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
                {selectedGroups.every(id => pinnedGroups.includes(id)) ? "Открепить" : "Закрепить"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[menuStyles.item, menuStyles.cancel]} onPress={() => setShowPinMenu(false)}>
              <Text style={[menuStyles.itemText, { color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8' }]}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
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
    flexGrow: 1,
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
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 14,
  },
  groupAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  groupAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  groupInfo: {
    flex: 1,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  groupName: {
    fontSize: 16,
    flexShrink: 1,
  },
  groupDescription: {
    fontSize: 14,
  },
  groupLastMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  hintText: {
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
})

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
})

export default GroupsListScreen