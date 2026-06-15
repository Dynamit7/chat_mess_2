import { useState, useEffect, useRef, useMemo } from "react"
import {
  View,
  Text,
  TextInput,
  Alert,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
  Linking,
  ScrollView,
  Keyboard,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import io from "socket.io-client"
import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Icon from "@expo/vector-icons/FontAwesome"
import Icon2 from "@expo/vector-icons/MaterialCommunityIcons"
import * as DocumentPicker from "expo-document-picker"
import { Video } from "expo-av"
import { Audio } from "expo-av"
import { BASE_URL } from "../src/config"
import { useTheme } from "../ThemeContext"
import EmojiKeyboard from "../components/EmojiKeyboard"
import ForwardSheet from "../components/ForwardSheet"
import PollCreator from "../components/messages/PollCreator"
import PollMessage from "../components/messages/PollMessage"
import useTranslateMessage from "../helpers/useTranslateMessage"

// const BASE_URL = Platform.select({
//   web: "http://192.168.77.41:3000",
//   default: "http://192.168.77.41:3000",
// })

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const formatDateLabel = (date) => {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (isSameDay(date, today)) {
    return "Сегодня"
  }
  if (isSameDay(date, yesterday)) {
    return "Вчера"
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  })
}

const getMimeTypeFromExtension = (fileName) => {
  const ext = fileName.split(".").pop().toLowerCase()
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg"
  if (ext === "png") return "image/png"
  if (ext === "gif") return "image/gif"
  if (["mp4", "mov"].includes(ext)) return "video/mp4"
  if (ext === "mp3") return "audio/mpeg"
  if (ext === "m4a") return "audio/m4a"
  if (ext === "webm") return "audio/webm"
  return "application/octet-stream"
}

const emojis = ["👍", "❤️", "🔥", "👏", "😮", "😢", "😡", "🎉"]
const quickEmojis = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😃",
  "😄",
  "😅",
  "😆",
  "😉",
  "😊",
  "😍",
  "😘",
  "😜",
  "🤩",
  "🤗",
  "🤔",
  "😎",
  "😢",
  "😭",
  "😡",
  "😱",
  "👍",
  "👎",
  "🙏",
  "👏",
  "🔥",
  "💯",
  "🎉",
  "❤️",
  "💔",
  "✨",
  "⚡",
  "🌟",
  "🎵",
  "🎮",
  "🍕",
  "☕",
  "🍀",
]

function AudioPlayer({ source }) {
  const [sound, setSound] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasFinished, setHasFinished] = useState(false)

  const handlePlayPause = async () => {
    try {
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(source)
        setSound(newSound)
        await newSound.playAsync()
        setIsPlaying(true)
        setHasFinished(false)
      } else {
        if (isPlaying) {
          await sound.pauseAsync()
          setIsPlaying(false)
        } else {
          if (hasFinished) {
            await sound.setPositionAsync(0)
            setHasFinished(false)
          }
          await sound.playAsync()
          setIsPlaying(true)
        }
      }
    } catch (error) {
      console.error("Ошибка воспроизведения аудио:", error)
    }
  }

  useEffect(() => {
    if (!sound) return
    const subscription = sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        setIsPlaying(false)
        setHasFinished(true)
      }
    })
    return () => {
      if (sound) {
        sound.setOnPlaybackStatusUpdate(null)
      }
    }
  }, [sound])

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync()
      }
    }
  }, [sound])

  let buttonLabel = "Воспроизвести"
  if (isPlaying) {
    buttonLabel = "Остановить"
  } else if (hasFinished) {
    buttonLabel = "Прослушать снова"
  }

  let bgColor = "#E0E0E0"
  if (isPlaying) {
    bgColor = "#29B6F6"
  } else if (hasFinished) {
    bgColor = "#81C784"
  }

  return (
    <TouchableOpacity onPress={handlePlayPause} style={[styles.audioPlayer, { backgroundColor: bgColor }]}>
      <Text style={styles.audioText}>{buttonLabel}</Text>
    </TouchableOpacity>
  )
}

function ChannelChatScreen({ route, navigation }) {
  const { isDarkMode } = useTheme()
  const { translations, translateMessage } = useTranslateMessage()
  const { channelId } = route.params
  const [userId, setUserId] = useState(null)
  const [channelName, setChannelName] = useState("")
  const [channelOwnerId, setChannelOwnerId] = useState(null)
  const [channelAvatar, setChannelAvatar] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [reactionModalVisible, setReactionModalVisible] = useState(false)
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null)
  const [reactions, setReactions] = useState({})
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState(null)
  const [actionModalVisible, setActionModalVisible] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const socketRef = useRef(null)
  const [optionModalVisible, setOptionModalVisible] = useState(false)
  const [optionList, setOptionList] = useState([])
  const [recording, setRecording] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [membersModalVisible, setMembersModalVisible] = useState(false)
  const [members, setMembers] = useState([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showPollCreator, setShowPollCreator] = useState(false)
  const [forwardSheetVisible, setForwardSheetVisible] = useState(false)
  const [messageToForward, setMessageToForward] = useState(null)
  const insets = useSafeAreaInsets()
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const flatListRef = useRef(null)

  const [activeChannelId, setActiveChannelId] = useState(null)

  // Отслеживаем высоту клавиатуры для динамического отступа
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height)
      }
    )
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0)
      }
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId")
        if (storedUserId) {
          setUserId(storedUserId)
        } else {
          console.log("AsyncStorage: userId не найден! Нужно авторизоваться.")
        }
      } catch (error) {
        console.error("Ошибка при загрузке userId:", error)
      }
    })()
  }, [])

  useEffect(() => {
    const socketInstance = io(`${BASE_URL}`, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ["websocket"],
      auth: async (cb) => {
        try {
          const token = await AsyncStorage.getItem("token");
          cb({ token: token || undefined });
        } catch (_) {
          cb({});
        }
      },
    })
    socketRef.current = socketInstance

    socketInstance.on("connect", () => {
      console.log("Socket connected, joining channel:", channelId)
      if (userId) {
        socketInstance.emit("joinChannel", {
          channelId: String(channelId),
          userId,
        })
      }
    })

      socketInstance.on('channelMarkedAsRead', ({ channelId: readChannelId, userId: readUserId }) => {
      if (String(readUserId) === String(userId) && String(readChannelId) === String(channelId)) {
        setUnreadCounts((prev) => ({
          ...prev,
          [readChannelId]: 0,
        }));
      }
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message)
    })

    socketInstance.on("channelMessageReceived", (messageData) => {
      console.log("Received channelMessageReceived:", messageData)
      if (String(messageData.channelId) === String(channelId)) {
        if (!messageData.parentMessageId) {
          console.log("New message received:", messageData)
          setMessages((prev) => {
            if (prev.some((msg) => String(msg.id) === String(messageData.id))) {
              return prev
            }
            return [...prev, messageData]
          })
        } else {
          console.log("New comment received for parentMessageId:", messageData.parentMessageId)
          setMessages((prev) =>
            prev.map((msg) =>
              String(msg.id) === String(messageData.parentMessageId)
                ? { ...msg, commentsCount: (msg.commentsCount || 0) + 1 }
                : msg,
            ),
          )
        }
      } else {
        console.log("Ignoring message for different channel:", messageData.channelId)
      }
    })

    socketInstance.on("channelMessageDeleted", async ({ messageId }) => {
      console.log("Received channelMessageDeleted:", messageId)
      const isTopLevelMessage = messages.some((msg) => String(msg.id) === String(messageId))
      if (isTopLevelMessage) {
        console.log("Top-level message deleted:", messageId)
        setMessages((prev) => prev.filter((msg) => String(msg.id) !== String(messageId)))
      } else {
        console.log("Assuming comment deleted, refreshing messages to update commentsCount")
        try {
          const resMessages = await axios.get(`${BASE_URL}/api/channels/${channelId}/messages`)
          console.log("Refreshed messages:", resMessages.data)
          setMessages(resMessages.data)
        } catch (error) {
          console.error("Error refreshing messages:", error.response?.data || error.message)
        }
      }
    })

    socketInstance.on("channelMessageUpdated", (updatedMessage) => {
      console.log("Received channelMessageUpdated:", updatedMessage)
      if (String(updatedMessage.channelId) === String(channelId) && !updatedMessage.parentMessageId) {
        setMessages((prev) => prev.map((msg) => (String(msg.id) === String(updatedMessage.id) ? updatedMessage : msg)))
      }
    })

    socketInstance.on("channelMessagesCleared", (data) => {
      console.log("Received channelMessagesCleared:", data)
      if (String(data.channelId) === String(channelId)) {
        console.log("Clearing messages for channel:", channelId)
        setMessages([])
      } else {
        console.log("Received event for different channel:", data.channelId)
      }
    })

    socketInstance.on("channelCommentsCleared", ({ channelId: eventChannelId, messageId }) => {
      console.log("Received channelCommentsCleared:", { eventChannelId, messageId })
      if (String(eventChannelId) === String(channelId)) {
        setMessages((prev) =>
          prev.map((msg) => (String(msg.id) === String(messageId) ? { ...msg, commentsCount: 0 } : msg)),
        )
      } else {
        console.log("Ignoring channelCommentsCleared for different channel:", eventChannelId)
      }
    })

    socketInstance.on("channelUpdated", (data) => {
      console.log("Received channelUpdated:", data)
      if (String(data.channelId) === String(channelId)) {
        if (data.updatedFields.name) {
          setChannelName(data.updatedFields.name)
        }
        if (data.updatedFields.images && data.updatedFields.images.length > 0) {
          setChannelAvatar(data.updatedFields.images[0])
        } else if (data.updatedFields.avatar) {
          setChannelAvatar(data.updatedFields.avatar)
        } else {
          setChannelAvatar(null)
        }
      }
    })

    socketInstance.on("channelDeleted", (data) => {
      console.log("Received channelDeleted:", data)
      if (String(data.channelId) === String(channelId)) {
        Alert.alert("Канал удалён", "Канал был удалён создателем.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ])
      }
    })

    socketInstance.on("reactionAdded", (reaction) => {
      console.log("Received reactionAdded:", reaction)
      if (String(reaction.channelId) === String(channelId)) {
        fetchReactions(reaction.messageId)
      }
    })

    socketInstance.on("reactionRemoved", ({ messageId, userId, emoji }) => {
      console.log("Received reactionRemoved:", { messageId, userId, emoji })
      if (messageId) {
        fetchReactions(messageId)
      }
    })

    socketInstance.on("channelRemoved", (data) => {
      console.log("Received channelRemoved:", data)
      if (String(data.channelId) === String(channelId)) {
        Alert.alert("Вы удалены", "Владелец удалил вас из канала.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ])
      }
    })

    return () => {
      console.log("Disconnecting socket for channel:", channelId)
      socketInstance.disconnect()
    }
  }, [userId, channelId, navigation])






  // В ChannelChatScreen, добавьте в useEffect или создайте отдельную функцию
 const markAsRead = async () => {
    if (!userId || !channelId) return;
    try {
      await axios.post(`${BASE_URL}/api/channels/${channelId}/update-last-seen`, {
        userId,
      });
      
      // Сбрасываем счетчик непрочитанных в глобальном состоянии
      // Для этого нужно передать функцию обновления или использовать контекст
      // Временное решение: эмитим событие через socket
      if (socketRef.current) {
        socketRef.current.emit('markChannelAsRead', { channelId, userId });
      }
      
      console.log(`Marked channel ${channelId} as read for user ${userId}`);
    } catch (err) {
      console.error("Ошибка при обновлении lastSeen:", err.response?.data || err.message);
    }
  };


// Вызывайте эту функцию при входе в канал
useEffect(() => {
    if (channelId && userId) {
      markAsRead();
      setActiveChannelId(channelId); // Устанавливаем активный канал
    }
  }, [channelId, userId]);







useEffect(() => {
  const updateLastSeen = async () => {
    if (!userId || !channelId) return;
    try {
      await axios.post(`${BASE_URL}/api/channels/${channelId}/update-last-seen`, {
        userId,
      });
      console.log(`Updated lastSeen for user ${userId} in channel ${channelId}`);
    } catch (err) {
      console.error("Ошибка при обновлении lastSeen:", err.response?.data || err.message);
    }
  };

  updateLastSeen();

  const fetchData = async () => {
    try {
      const resMessages = await axios.get(`${BASE_URL}/api/channels/${channelId}/messages`);
      console.log("Fetched messages:", resMessages.data);
      setMessages(resMessages.data);

      const resChannel = await axios.get(`${BASE_URL}/api/channels/id/${channelId}`);
      const channelData = resChannel.data;
      console.log("Fetched channel data:", channelData);
      console.log("userId:", userId, "channelOwnerId:", channelData.ownerId);
      setChannelOwnerId(channelData.ownerId);
      setChannelName(channelData.name);

      if (channelData.images && channelData.images.length > 0) {
        setChannelAvatar(channelData.images[0]);
      } else if (channelData.avatar) {
        setChannelAvatar(channelData.avatar);
      } else {
        setChannelAvatar(null);
      }
    } catch (err) {
      console.error("Ошибка при загрузке сообщений/канала:", err.response?.data || err.message);
    }
  };
  fetchData();
}, [channelId, userId]);

  const fetchReactions = async (messageId) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/channels/reactions/${messageId}`)
      console.log("Fetched reactions for message", messageId, ":", response.data)
      setReactions((prev) => ({
        ...prev,
        [messageId]: response.data,
      }))
    } catch (error) {
      console.error("Ошибка при получении реакций:", error)
    }
  }

  const handleReaction = async (messageId, emoji) => {
    if (!userId) return
    try {
      await axios.post(`${BASE_URL}/api/channels/react`, {
        messageId,
        userId,
        emoji,
        channelId,
      })
      setReactions((prev) => {
        const messageReactions = prev[messageId] || {}
        const hasUserReacted = messageReactions[emoji]?.users.includes(userId)
        if (hasUserReacted) {
          const updated = { ...prev }
          if (updated[messageId]?.[emoji]) {
            updated[messageId][emoji].count -= 1
            updated[messageId][emoji].users = updated[messageId][emoji].users.filter((id) => id !== userId)
            if (updated[messageId][emoji].count <= 0) {
              delete updated[messageId][emoji]
            }
            if (Object.keys(updated[messageId]).length === 0) {
              delete updated[messageId]
            }
          }
          return updated
        } else {
          return {
            ...prev,
            [messageId]: {
              ...messageReactions,
              [emoji]: {
                count: (messageReactions[emoji]?.count || 0) + 1,
                users: [...(messageReactions[emoji]?.users || []), userId],
              },
            },
          }
        }
      })
    } catch (error) {
      console.error("Ошибка при обработке реакции:", error)
      fetchReactions(messageId)
    }
  }

  const showReactionModal = (message) => {
    setSelectedMessageForReaction(message)
    fetchReactions(message.id)
    setReactionModalVisible(true)
  }

  const handleFetchMembers = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/channels/members/${channelId}?userId=${userId}`)
      setMembers(res.data || [])
      setMembersModalVisible(true)
    } catch (err) {
      console.error("Ошибка при получении подписчиков:", err.response?.data || err.message)
      setMembers([])
      setMembersModalVisible(true)
    }
  }

  const handleRemoveMember = async (memberId) => {
    try {
      await axios.delete(`${BASE_URL}/api/channels/${channelId}/members/${memberId}`, { data: { userId } })
      setMembers((prevMembers) => prevMembers.filter((member) => member.id !== memberId))
    } catch (error) {
      console.error("Ошибка при удалении участника:", error.response?.data || error.message)
      Alert.alert("Ошибка", "Не удалось удалить участника")
    }
  }

  const startRecording = async () => {
    if (Platform.OS === "web") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Alert.alert("Ошибка", "Ваш браузер не поддерживает запись звука.")
        return
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasAudioInput = devices.some((device) => device.kind === "audioinput")
        if (!hasAudioInput) {
          Alert.alert("Ошибка", "Микрофон не найден.")
          return
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        let chunks = []
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data)
          }
        }
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" })
          const file = new File([blob], "voice_message.webm", {
            type: "audio/webm",
          })
          handleSendFile(file)
          chunks = []
        }
        mediaRecorder.start()
        setRecording(mediaRecorder)
        setIsRecording(true)
      } catch (err) {
        console.error("Ошибка записи в веб:", err)
        Alert.alert("Ошибка записи", "Не удалось начать запись.")
      }
    } else {
      try {
        const permission = await Audio.requestPermissionsAsync()
        if (permission.status !== "granted") {
          Alert.alert("Нет разрешения", "Нужно дать доступ к микрофону")
          return
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        })
        const newRecording = new Audio.Recording()
        await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY)
        await newRecording.startAsync()
        setRecording(newRecording)
        setIsRecording(true)
      } catch (err) {
        console.error("Ошибка старта записи:", err)
      }
    }
  }

  const stopRecording = async () => {
    if (Platform.OS === "web") {
      if (recording && recording.state === "recording") {
        recording.stop()
        setIsRecording(false)
        setRecording(null)
      }
    } else {
      try {
        await recording.stopAndUnloadAsync()
        const uri = recording.getURI()
        setIsRecording(false)
        setRecording(null)
        const file = {
          uri,
          name: "voice_message.m4a",
          type: "audio/m4a",
        }
        handleSendFile(file)
      } catch (err) {
        console.error("Ошибка при остановке записи:", err)
      }
    }
  }

const handleSendMessage = async () => {
  if (!newMessage.trim()) {
    Alert.alert("Ошибка", "Сообщение не может быть пустым")
    return
  }
  if (String(userId) !== String(channelOwnerId)) {
    Alert.alert("Ошибка", "Только создатель канала может отправлять сообщения")
    return
  }
  try {
    console.log("Sending message:", { text: newMessage, replyingTo: replyingTo?.id, editingMessage })
    const messageData = {
      userId,
      text: newMessage,
      channelId: String(channelId),
      ...(replyingTo && { parentMessageId: String(replyingTo.id) }),
    }

    let response;
    if (editingMessage) {
      // Режим редактирования: отправляем PUT-запрос
      response = await axios.put(
        `${BASE_URL}/api/channels/${channelId}/message/${editingMessage.id}`,
        messageData
      )
      console.log("Message updated successfully, response:", response.data)
      setEditingMessage(null)
    } else {
      // Режим создания нового сообщения: отправляем POST-запрос  
      response = await axios.post(
        `${BASE_URL}/api/channels/${channelId}/message`,
        messageData
      )
      console.log("Message sent successfully, response:", response.data)
    }

    setNewMessage("")
    setReplyingTo(null)
  } catch (error) {
    console.error("Ошибка при отправке/обновлении сообщения:", error.response?.data || error.message)
    Alert.alert("Ошибка", "Не удалось отправить/обновить сообщение")
  }
  setSelectedMessage(null)
  setActionModalVisible(false)
}

  const handleSendFile = async (file, isUpdate = false) => {
    if (String(userId) !== String(channelOwnerId)) {
      Alert.alert("Ошибка", "Только создатель канала может отправлять файлы")
      return
    }
    const formData = new FormData()
    if (Platform.OS === "web" && file.uri) {
      try {
        const response = await fetch(file.uri)
        const blob = await response.blob()
        const fileToUpload = new File([blob], file.name || "file", {
          type: file.mimeType || getMimeTypeFromExtension(file.name),
        })
        formData.append("file", fileToUpload)
      } catch (error) {
        console.error("Ошибка при преобразовании файла:", error)
        Alert.alert("Ошибка", "Не удалось обработать файл")
        return
      }
    } else if (file.uri) {
      const mimeType = getMimeTypeFromExtension(file.name)
      formData.append("file", {
        uri: file.uri,
        name: file.name || "file",
        type: mimeType,
      })
    } else if (file instanceof File) {
      formData.append("file", file)
    }
    formData.append("userId", userId)
    formData.append("text", "")
    if (replyingTo && !isUpdate) {
      formData.append("parentMessageId", String(replyingTo.id))
    }

    try {
      console.log("Sending file:", { fileName: file.name, replyingTo: replyingTo?.id })
      if (isUpdate && editingMessage) {
        await axios.put(`${BASE_URL}/api/channels/${channelId}/message/${editingMessage.id}`, formData)
        const resMessages = await axios.get(`${BASE_URL}/api/channels/${channelId}/messages`)
        setMessages(resMessages.data)
        setEditingMessage(null)
        setReplyingTo(null)
      } else {
        await axios.post(`${BASE_URL}/api/channels/${channelId}/message`, formData)
        setReplyingTo(null)
      }
      console.log("File sent successfully")
    } catch (err) {
      console.error("Ошибка при отправке файла:", err.response?.data || err.message)
      Alert.alert("Ошибка", "Не удалось отправить файл")
    }
    setSelectedMessage(null)
    setActionModalVisible(false)
  }

  const pickFile = async (isUpdate = false) => {
    const result = await DocumentPicker.getDocumentAsync({})
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const file = result.assets[0]
      handleSendFile(file, isUpdate)
    }
  }

  const leaveChannel = async () => {
    try {
      if (!userId) return
      await axios.delete(`${BASE_URL}/api/channels/${channelId}/leave`, {
        data: { userId },
      })
      navigation.goBack()
    } catch (err) {
      console.error("Ошибка при выходе из канала:", err.response?.data || err.message)
    }
  }

  const deleteChannel = async () => {
    try {
      if (!userId) return
      await axios.delete(`${BASE_URL}/api/channels/${channelId}`, {
        data: { userId },
      })
      navigation.goBack()
    } catch (err) {
      console.error("Ошибка при удалении канала:", err.response?.data || err.message)
    }
  }

  const clearMessages = async () => {
    try {
      console.log("Clearing messages for channel:", channelId)
      setNewMessage("")
      setMessages([])
      await axios.delete(`${BASE_URL}/api/channels/${channelId}/messages`, {
        data: { userId },
      })
    } catch (err) {
      console.error("Ошибка при очистке сообщений:", err.response?.data || err.message)
    }
  }

  const reportChannel = async () => {
    try {
      await axios.post(`${BASE_URL}/api/channels/${channelId}/report`, {
        userId,
      })
      Alert.alert("Жалоба", "Ваша жалоба принята!")
    } catch (err) {
      console.error("Ошибка при отправке жалобы:", err.response?.data || err.message)
    }
  }

  const showChannelOptions = () => {
    if (String(channelOwnerId) === String(userId)) {
      setOptionList([
        {
          text: "Удалить канал",
          onPress: () => {
            setOptionModalVisible(false)
            deleteChannel()
          },
          style: "destructive",
        },
        {
          text: "Очистить все сообщения",
          onPress: () => {
            setOptionModalVisible(false)
            clearMessages()
          },
        },
        {
          text: "Участники",
          onPress: () => {
            setOptionModalVisible(false)
            handleFetchMembers()
          },
        },
        {
          text: "Отмена",
          onPress: () => setOptionModalVisible(false),
          style: "cancel",
        },
      ])
    } else {
      setOptionList([
        {
          text: "Выйти из канала",
          onPress: () => {
            setOptionModalVisible(false)
            leaveChannel()
          },
        },
        {
          text: "Пожаловаться",
          onPress: () => {
            setOptionModalVisible(false)
            reportChannel()
          },
        },
        {
          text: "Отмена",
          onPress: () => setOptionModalVisible(false),
          style: "cancel",
        },
      ])
    }
    setOptionModalVisible(true)
  }

  const handleDeleteMessage = async (message) => {
    if (String(channelOwnerId) === String(userId) || String(message.userId) === String(userId)) {
      try {
        await axios.delete(`${BASE_URL}/api/channels/${channelId}/message/${message.id}`, { data: { userId } })
        setMessages((prev) => prev.filter((msg) => String(msg.id) !== String(message.id)))
      } catch (error) {
        console.error("Ошибка при удалении сообщения:", error.response?.data || error.message)
        Alert.alert("Ошибка", "Не удалось удалить сообщение")
      }
    } else {
      Alert.alert("Нет прав", "Вы не можете удалить это сообщение.")
    }
    setSelectedMessage(null)
    setActionModalVisible(false)
  }

  const handleInitiateEditMessage = (message) => {
    if (String(channelOwnerId) === String(userId) || String(message.userId) === String(userId)) {
      if (message.type === "text") {
        setNewMessage(message.text)
        setEditingMessage(message)
      } else if (message.type === "image") {
        setEditingMessage(message)
        pickFile(true)
      } else {
        Alert.alert("Редактирование не поддерживается", "Можно редактировать только текст и изображения.")
      }
    } else {
      Alert.alert("Нет прав", "Вы не можете редактировать это сообщение.")
    }
    setSelectedMessage(null)
    setActionModalVisible(false)
  }

  const handleInitiateReply = (message) => {
    console.log("Initiating reply to message:", message.id, "by user:", userId, "channelOwnerId:", channelOwnerId)
    if (String(userId) !== String(channelOwnerId)) {
      Alert.alert("Ошибка", "Только создатель канала может отвечать на сообщения")
      return
    }
    setReplyingTo(message)
    setSelectedMessage(null)
    setActionModalVisible(false)
  }

  const handleLongPressMessage = (message) => {
    console.log("Long press message:", message.id, "userId:", userId, "channelOwnerId:", channelOwnerId)
    // Allow long press for all users (forward is available to everyone)
    setSelectedMessage(message)
    setActionModalVisible(true)
  }

  const handleImagePress = (fileUrl) => {
    const imageUrl = fileUrl.startsWith("http://") || fileUrl.startsWith("https://") ? fileUrl : `${BASE_URL}${fileUrl}`
    setSelectedImageUrl(imageUrl)
    setImageModalVisible(true)
  }

  const cancelReply = () => {
    console.log("Cancelling reply")
    setReplyingTo(null)
  }

  const handleInsertEmoji = (emoji) => {
    setNewMessage((prev) => (prev || "") + emoji)
  }

  // Enhanced reply preview component
  const renderReplyPreview = (repliedMessage) => {
    if (!repliedMessage) return null

    return (
      <View style={styles.replyPreviewContainer}>
        <View style={styles.replyLine} />
        <View style={styles.replyContent}>
          <Text style={styles.replyAuthor}>{repliedMessage.sender?.username || `User ${repliedMessage.userId}`}</Text>
          {repliedMessage.type === "text" && repliedMessage.text ? (
            <Text style={styles.replyText} numberOfLines={2}>
              {repliedMessage.text}
            </Text>
          ) : repliedMessage.type === "image" && repliedMessage.fileUrl ? (
            <View style={styles.replyMediaContainer}>
              <Image
                source={{
                  uri:
                    repliedMessage.fileUrl.startsWith("http://") || repliedMessage.fileUrl.startsWith("https://")
                      ? repliedMessage.fileUrl
                      : `${BASE_URL}${repliedMessage.fileUrl}`,
                }}
                style={styles.replyImage}
                resizeMode="cover"
                onError={(e) =>
                  console.error(`Reply image load error for ${repliedMessage.fileUrl}:`, e.nativeEvent.error)
                }
              />
              <Text style={styles.replyMediaText}>Фото</Text>
            </View>
          ) : repliedMessage.type === "video" ? (
            <Text style={styles.replyMediaText}>🎥 Видео</Text>
          ) : repliedMessage.type === "audio" ? (
            <Text style={styles.replyMediaText}>🎵 Аудио</Text>
          ) : repliedMessage.type === "file" ? (
            <Text style={styles.replyMediaText}>📎 {repliedMessage.filename || "Файл"}</Text>
          ) : (
            <Text style={styles.replyText}>[Содержимое удалено]</Text>
          )}
        </View>
      </View>
    )
  }

  // Автоматический скролл вниз при появлении новых сообщений
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [messages.length])

  const chatItems = useMemo(() => {
    const items = []
    let lastLabel = null

    messages.forEach((message, index) => {
      const createdAt = message.createdAt ? new Date(message.createdAt) : null
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        const label = formatDateLabel(createdAt)
        if (label !== lastLabel) {
          lastLabel = label
          items.push({
            type: "date",
            id: `date-${createdAt.toISOString().split("T")[0]}-${index}`,
            label,
          })
        }
      }
      items.push({ type: "message", data: message })
    })

    return items
  }, [messages])

  const renderItem = ({ item }) => {
    if (item.type === "date") {
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{item.label}</Text>
          </View>
        </View>
      )
    }

    const message = item.data
    const isMyMessage = String(message.userId) === String(userId)
    const messageReactions = reactions[message.id] || {}
    const repliedMessage = message.parentMessageId
      ? messages.find((m) => String(m.id) === String(message.parentMessageId))
      : null
    const isSelectedMsg = selectedMessage && selectedMessage.id === message.id

    return (
      <View style={isSelectedMsg && styles.selectedRow}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => showReactionModal(message)}
        onLongPress={() => handleLongPressMessage(message)}
      >
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : [styles.otherMessage, isDarkMode && { backgroundColor: '#121826', borderColor: '#1A2233' }]]}>
          {/* Enhanced reply preview */}
          {message.parentMessageId && repliedMessage && (
            <View style={styles.replyPreviewContainer}>
              <View style={styles.replyLine} />
              <View style={styles.replyContent}>
                <Text style={styles.replyAuthor}>
                  {repliedMessage.sender?.username || `User ${repliedMessage.userId}`}
                </Text>
                {repliedMessage.type === "text" && repliedMessage.text ? (
                  <Text style={styles.replyText} numberOfLines={2}>
                    {repliedMessage.text}
                  </Text>
                ) : repliedMessage.type === "image" && repliedMessage.fileUrl ? (
                  <View style={styles.replyMediaContainer}>
                    <Image
                      source={{
                        uri:
                          repliedMessage.fileUrl.startsWith("http://") || repliedMessage.fileUrl.startsWith("https://")
                            ? repliedMessage.fileUrl
                            : `${BASE_URL}${repliedMessage.fileUrl}`,
                      }}
                      style={styles.replyImage}
                      resizeMode="cover"
                      onError={(e) =>
                        console.error(`Reply image load error for ${repliedMessage.fileUrl}:`, e.nativeEvent.error)
                      }
                    />
                    <Text style={styles.replyMediaText}>Фото</Text>
                  </View>
                ) : repliedMessage.type === "video" ? (
                  <Text style={styles.replyMediaText}>🎥 Видео</Text>
                ) : repliedMessage.type === "audio" ? (
                  <Text style={styles.replyMediaText}>🎵 Аудио</Text>
                ) : repliedMessage.type === "file" ? (
                  <Text style={styles.replyMediaText}>📎 {repliedMessage.filename || "Файл"}</Text>
                ) : (
                  <Text style={styles.replyText}>[Содержимое удалено]</Text>
                )}
              </View>
            </View>
          )}

          {message.sender && (
            <Text style={[styles.messageUser, isMyMessage && styles.myMessageUser, !isMyMessage && isDarkMode && { color: '#a0a0b0' }]}>{message.sender.username}</Text>
          )}

          {message.forwardedFromUsername ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 }}>
              <Icon2 name="share" size={12} color={isMyMessage ? 'rgba(255,255,255,0.8)' : '#7C5CFF'} />
              <Text style={{ fontSize: 12, fontStyle: 'italic', color: isMyMessage ? 'rgba(255,255,255,0.8)' : '#7C5CFF' }}>
                Переслано от {message.forwardedFromUsername}
              </Text>
            </View>
          ) : null}

          {message.type === "text" && message.text ? (
            <Text style={[styles.messageText, isMyMessage && styles.myMessageText, !isMyMessage && isDarkMode && { color: '#e0e0e0' }]}>{message.text}</Text>
          ) : null}

          {message.type === "image" && message.fileUrl ? (
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleImagePress(message.fileUrl)}>
              <Image
                source={{
                  uri: message.fileUrl.startsWith("http://") || message.fileUrl.startsWith("https://")
                    ? message.fileUrl
                    : `${BASE_URL}${message.fileUrl}`,
                }}
                style={styles.messageImage}
                resizeMode="contain"
                onError={(e) => console.error(`Image load error for ${message.fileUrl}:`, e.nativeEvent.error)}
              />
            </TouchableOpacity>
          ) : null}

          {message.type === "video" && message.fileUrl ? (
            <Video
              source={{
                uri: message.fileUrl.startsWith("http://") || message.fileUrl.startsWith("https://")
                  ? message.fileUrl
                  : `${BASE_URL}${message.fileUrl}`,
              }}
              style={styles.messageImage}
              useNativeControls
              resizeMode="contain"
            />
          ) : null}

          {message.type === "audio" && message.fileUrl ? (
            <AudioPlayer
              source={{
                uri: message.fileUrl.startsWith("http://") || message.fileUrl.startsWith("https://")
                  ? message.fileUrl
                  : `${BASE_URL}${message.fileUrl}`,
              }}
            />
          ) : null}

          {message.type === "file" && message.fileUrl ? (
            <TouchableOpacity
              onPress={() => {
                const fileUrl =
                  message.fileUrl.startsWith("http://") || message.fileUrl.startsWith("https://")
                    ? message.fileUrl
                    : `${BASE_URL}${message.fileUrl}`
                Linking.openURL(fileUrl).catch((err) => console.error("Error opening file:", err))
              }}
            >
              <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
                Файл: {message.filename || "Без названия"}
              </Text>
            </TouchableOpacity>
          ) : null}

          {message.type === "poll" ? (
            <View style={{ width: 280, maxWidth: '100%' }}>
              <PollMessage poll={message.poll} pollId={message.pollId} />
            </View>
          ) : null}

          {Object.keys(messageReactions).length > 0 && (
            <View style={styles.reactionsContainer}>
              {Object.entries(messageReactions).map(([emoji, reaction]) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.reactionItem,
                    reaction.users.includes(userId) && styles.myReaction,
                    isMyMessage && styles.reactionItemMy,
                  ]}
                  onPress={() => handleReaction(message.id, emoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={styles.reactionCount}>{reaction.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Translation */}
          {translations?.[message.id]?.text && (
            <View style={{
              marginTop: 6, padding: 8, borderRadius: 8,
              backgroundColor: isMyMessage ? 'rgba(255,255,255,0.12)' : (isDarkMode ? 'rgba(124, 92, 255, 0.1)' : 'rgba(124, 92, 255, 0.06)'),
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: isMyMessage ? 'rgba(255,255,255,0.6)' : '#7C5CFF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Перевод</Text>
              <Text style={{ fontSize: 14, color: isMyMessage ? '#fff' : (isDarkMode ? '#F5F7FA' : '#333') }}>{translations[message.id].text}</Text>
            </View>
          )}
          {translations?.[message.id]?.error && (
            <Text style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>{translations[message.id].error}</Text>
          )}

          <View style={styles.metaRow}>
            {message.text && (
              <TouchableOpacity
                onPress={() => translateMessage(message.id, message.text)}
                style={{ padding: 2, marginRight: 4 }}
                activeOpacity={0.7}
              >
                <Icon2 name="translate" size={13} color={isMyMessage ? 'rgba(255,255,255,0.5)' : (isDarkMode ? 'rgba(255,255,255,0.3)' : '#aaa')} />
              </TouchableOpacity>
            )}
            <Text style={[styles.timestamp, isMyMessage && styles.timestampMy, !isMyMessage && isDarkMode && { color: '#888' }]}>
              {message.createdAt
                ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : ""}
            </Text>
            {(message.commentsCount || 0) > 0 && (
              <Text style={styles.commentCount}>{message.commentsCount} комментариев</Text>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.commentButton,
              isMyMessage ? styles.commentButtonMy : styles.commentButtonOther,
            ]}
            onPress={() => {
              navigation.navigate("ChannelCommentsScreen", {
                channelId,
                postId: message.id,
              })
            }}
          >
            <Text style={styles.commentButtonText}>Оставить комментарий</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      </View>
    )
  }

  const getInitialLetter = () => {
    return channelName ? channelName.charAt(0).toUpperCase() : "C"
  }

  const renderMemberItem = ({ item }) => {
    return (
      <View style={styles.memberItem}>
        <Text style={styles.memberText}>{item.username}</Text>
        {String(item.id) !== String(userId) && (
          <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveMember(item.id)}>
            <Text style={styles.removeButtonText}>Удалить</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <Pressable
      onPress={() => {
        setSelectedMessage(null)
        setReactionModalVisible(false)
        setImageModalVisible(false)
        setActionModalVisible(false)
      }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF' }]}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.select({
          ios: 64 + (insets.top || 0),
          android: -(insets.bottom || 0)
        })}
        enabled={true}
      >
        <View style={[styles.header, { backgroundColor: isDarkMode ? '#0B0F19' : '#7C5CFF' }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="angle-left" size={30} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerMiddle}>
            {channelAvatar ? (
              <Image
                source={{
                  uri:
                    channelAvatar.startsWith("http://") || channelAvatar.startsWith("https://")
                      ? channelAvatar
                      : `${BASE_URL}${channelAvatar}?t=${Date.now()}`,
                }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{getInitialLetter()}</Text>
              </View>
            )}
            <View style={{ marginLeft: 10 }}>
              <TouchableOpacity onPress={() => navigation.navigate("ChannelProfileScreen", { channelId })}>
                <Text style={styles.username}>{channelName || "Channel Chat"}</Text>
              </TouchableOpacity>
              <Text style={styles.channelInfo}>ID: {channelId}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={showChannelOptions}>
            <Icon name="ellipsis-v" size={25} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[{ flex: 1, minHeight: 0 }, showEmojiPicker && { maxHeight: Math.max(SCREEN_HEIGHT - 280 - 180 - (insets.bottom || 0), 100) }]}>
          <FlatList
            ref={flatListRef}
            data={chatItems}
            renderItem={renderItem}
            keyExtractor={(item) =>
              item.type === "date"
                ? item.id
                : item.data?.id?.toString() || Math.random().toString()
            }
            style={styles.messagesList}
            contentContainerStyle={[
              styles.messagesContentContainer,
              Platform.OS === 'android' && keyboardHeight > 0 && {
                paddingBottom: keyboardHeight + 100,
              }
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            scrollEnabled={true}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            onScrollToIndexFailed={({ index }) => {
              flatListRef.current?.scrollToOffset({
                offset: index * 100,
                animated: true,
              })
            }}
          />
        </View>

        {String(userId) === String(channelOwnerId) ? (
        <View>
          <View style={[
            styles.inputContainer,
            {
              backgroundColor: isDarkMode ? '#0B0F19' : "#FFFFFF",
              paddingTop: 8,
              paddingBottom: showEmojiPicker ? 0 : (Platform.OS === 'android'
                ? (insets.bottom || 0) + (keyboardHeight > 0 ? 12 : 0)
                : insets.bottom || 0),
            }
          ]}>
            {/* Enhanced reply preview in input area */}
            {replyingTo && (
              <View style={styles.inputReplyPreview}>
                <View style={styles.inputReplyLine} />
                <View style={styles.inputReplyHeader}>
                  <View style={styles.inputReplyHeaderLeft}>
                    <Icon name="mail-reply" size={14} color="#00C2FF" style={{ marginRight: 6 }} />
                    <Text style={styles.inputReplyAuthor} numberOfLines={1}>
                      {replyingTo.sender?.username || `User ${replyingTo.userId}`}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={cancelReply} 
                    style={styles.cancelReplyButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name="close" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
                {replyingTo.text ? (
                  <Text style={styles.inputReplyText} numberOfLines={2}>
                    {replyingTo.text}
                  </Text>
                ) : replyingTo.type === "image" ? (
                  <View style={styles.replyPreviewMedia}>
                    <Icon name="picture-o" size={14} color="#00C2FF" style={{ marginRight: 4 }} />
                    <Text style={styles.inputReplyText}>Фото</Text>
                  </View>
                ) : replyingTo.type === "video" ? (
                  <View style={styles.replyPreviewMedia}>
                    <Icon name="video-camera" size={14} color="#00C2FF" style={{ marginRight: 4 }} />
                    <Text style={styles.inputReplyText}>Видео</Text>
                  </View>
                ) : replyingTo.type === "audio" ? (
                  <View style={styles.replyPreviewMedia}>
                    <Icon name="microphone" size={14} color="#00C2FF" style={{ marginRight: 4 }} />
                    <Text style={styles.inputReplyText}>Голосовое сообщение</Text>
                  </View>
                ) : (
                  <View style={styles.replyPreviewMedia}>
                    <Icon name="paperclip" size={14} color="#00C2FF" style={{ marginRight: 4 }} />
                    <Text style={styles.inputReplyText}>Файл</Text>
                  </View>
                )}
              </View>
            )}
            <View style={[styles.inputRow, isDarkMode && { backgroundColor: '#121826' }]}>
              <TouchableOpacity
                style={styles.iconBubble}
                onPress={() => {
                  if (showEmojiPicker) {
                    setShowEmojiPicker(false);
                  } else {
                    Keyboard.dismiss();
                    setTimeout(() => setShowEmojiPicker(true), 200);
                  }
                }}
              >
                <Icon name="smile-o" size={18} color="#7C5CFF" />
              </TouchableOpacity>
              <TextInput
                style={[styles.textInput, isDarkMode && { color: '#e0e0e0' }]}
                placeholder={
                  editingMessage
                    ? "Редактировать сообщение..."
                    : replyingTo
                      ? "Введите ответ..."
                      : "Сообщение..."
                }
                placeholderTextColor={isDarkMode ? "#666" : "#A4A3BA"}
                value={newMessage}
                onChangeText={setNewMessage}
                onSubmitEditing={handleSendMessage}
                multiline
                maxLength={4096}
                textAlignVertical="top"
                includeFontPadding={false}
                onFocus={() => {
                  setShowEmojiPicker(false)
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }, 300)
                }}
              />
              <TouchableOpacity
                style={styles.iconBubble}
                onPress={() => {
                  if (editingMessage && editingMessage.type === "image") {
                    pickFile(true)
                  } else {
                    pickFile()
                  }
                }}
              >
                <Icon name="paperclip" size={18} color="#7C5CFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBubble}
                onPress={() => {
                  Keyboard.dismiss()
                  setShowPollCreator(true)
                }}
              >
                <Icon2 name="poll" size={20} color="#7C5CFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBubble, isRecording && styles.recordingBubble]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Icon
                  name={isRecording ? "stop" : "microphone"}
                  size={18}
                  color={isRecording ? "#fff" : "#7C5CFF"}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                <Icon2 name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

          </View>
          {showEmojiPicker && (
            <EmojiKeyboard onEmojiSelect={handleInsertEmoji} onClose={() => setShowEmojiPicker(false)} height={280} />
          )}
        </View>
        ) : (
          <View style={[styles.infoContainer, isDarkMode && { backgroundColor: '#0B0F19' }]}>
            <Text style={[styles.infoText, isDarkMode && { color: '#a0a0b0' }]}>В этом канале может писать сообщения только создатель.</Text>
          </View>
        )}

        <Modal
          visible={optionModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setOptionModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setOptionModalVisible(false)}>
            <View style={[styles.modalContainer, isDarkMode && { backgroundColor: '#121826' }]}>
              {optionList.map((option, index) => (
                <TouchableOpacity key={index} style={styles.modalButton} onPress={option.onPress}>
                  <Text style={[styles.modalButtonText, isDarkMode && { color: '#e0e0e0' }, option.style === "destructive" && { color: "red" }, option.style === "cancel" && { color: isDarkMode ? '#888' : '#666' }]}>
                    {option.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={membersModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMembersModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setMembersModalVisible(false)}>
            <View style={[styles.modalContainer, { maxHeight: "50%" }, isDarkMode && { backgroundColor: '#121826' }]}>
              <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10, color: isDarkMode ? '#e0e0e0' : '#000' }}>Участники канала</Text>
              {members.length === 0 ? (
                <Text style={{ fontSize: 16, color: isDarkMode ? '#888' : "#555" }}>Нет данных или у вас нет прав</Text>
              ) : (
                <FlatList data={members} keyExtractor={(item) => item.id.toString()} renderItem={renderMemberItem} />
              )}
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={reactionModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReactionModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setReactionModalVisible(false)}>
            <View style={[styles.reactionModalContent, isDarkMode && { backgroundColor: '#121826' }]}>
              <View style={styles.reactionsGrid}>
                {emojis.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionOption, isDarkMode && { backgroundColor: '#1A2233' }]}
                    onPress={() => {
                      handleReaction(selectedMessageForReaction.id, emoji)
                      setReactionModalVisible(false)
                    }}
                  >
                    <Text style={styles.reactionOptionText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>

        {imageModalVisible && selectedImageUrl && (
          <Modal
            animationType="fade"
            transparent={true}
            visible={imageModalVisible}
            onRequestClose={() => setImageModalVisible(false)}
          >
            <View style={styles.imageModalOverlay}>
              <TouchableOpacity style={styles.imageModalCloseButton} onPress={() => setImageModalVisible(false)}>
                <Icon name="times" size={30} color="#fff" />
              </TouchableOpacity>
              <Image
                source={{ uri: selectedImageUrl }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                onError={(e) =>
                  console.error(`Full screen image load error for ${selectedImageUrl}:`, e.nativeEvent.error)
                }
              />
            </View>
          </Modal>
        )}

        {actionModalVisible && selectedMessage && (
          <Modal
            animationType="fade"
            transparent={true}
            visible={actionModalVisible}
            onRequestClose={() => setActionModalVisible(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => {
                setActionModalVisible(false)
                setSelectedMessage(null)
              }}
            >
              <TouchableWithoutFeedback>
                <View style={[styles.actionModalContent, isDarkMode && { backgroundColor: '#121826' }]}>
                  {String(channelOwnerId) === String(userId) && (
                    <TouchableOpacity
                      style={styles.actionModalButton}
                      onPress={() => handleInitiateReply(selectedMessage)}
                    >
                      <Text style={[styles.actionModalButtonText, isDarkMode && { color: '#e0e0e0' }]}>Ответить</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actionModalButton}
                    onPress={() => {
                      setMessageToForward({
                        id: selectedMessage.id,
                        sourceType: 'channel',
                        text: selectedMessage.text || '',
                        type: selectedMessage.type || 'text',
                        fileUrl: selectedMessage.fileUrl || null,
                        filename: selectedMessage.filename || null,
                        senderUsername: selectedMessage.sender?.username || channelName || '',
                      });
                      setForwardSheetVisible(true)
                      setActionModalVisible(false)
                      setSelectedMessage(null)
                    }}
                  >
                    <Text style={[styles.actionModalButtonText, isDarkMode && { color: '#7C5CFF' }]}>Переслать</Text>
                  </TouchableOpacity>
                  {(String(channelOwnerId) === String(userId) || String(selectedMessage.userId) === String(userId)) && (
                    <>
                      <TouchableOpacity
                        style={styles.actionModalButton}
                        onPress={() => handleDeleteMessage(selectedMessage)}
                      >
                        <Text style={styles.actionModalDestructiveText}>Удалить</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionModalButton}
                        onPress={() => handleInitiateEditMessage(selectedMessage)}
                      >
                        <Text style={[styles.actionModalButtonText, isDarkMode && { color: '#e0e0e0' }]}>Редактировать</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.actionModalButton}
                    onPress={() => {
                      setActionModalVisible(false)
                      setSelectedMessage(null)
                    }}
                  >
                    <Text style={[styles.actionModalButtonText, isDarkMode && { color: '#888' }]}>Отмена</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </Pressable>
          </Modal>
        )}
      <ForwardSheet
        visible={forwardSheetVisible && !!messageToForward}
        onClose={() => {
          setForwardSheetVisible(false)
          setMessageToForward(null)
        }}
        messageToForward={messageToForward}
        currentUserId={userId ? Number(userId) : null}
        isDarkMode={isDarkMode}
      />

      <Modal
        visible={showPollCreator}
        animationType="slide"
        onRequestClose={() => setShowPollCreator(false)}
      >
        <PollCreator
          channelId={Number(channelId)}
          onClose={() => setShowPollCreator(false)}
          onPollCreated={() => setShowPollCreator(false)}
        />
      </Modal>
      </KeyboardAvoidingView>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  selectedRow: {
    backgroundColor: 'rgba(124, 92, 255, 0.08)',
    borderRadius: 16,
  },
  container: {
    flex: 1,
    backgroundColor: "#F7F3FC",
    overflow: 'hidden',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C5CFF",
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  backButton: {
    paddingRight: 10,
  },
  headerMiddle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    paddingLeft: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ccc",
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#7C5CFF",
  },
  username: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  channelInfo: {
    color: "#E0E0E0",
    fontSize: 14,
  },
  messagesList: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 8,
  },
  messagesContentContainer: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  dateSeparator: {
    alignItems: "center",
    marginVertical: 8,
  },
  dateChip: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(124, 92, 255, 0.12)",
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7C5CFF",
    textTransform: "capitalize",
  },
  messageBubble: {
    marginVertical: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    maxWidth: "82%",
    position: "relative",
    elevation: 3,
    shadowColor: "#121826",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#7C5CFF",
    borderBottomRightRadius: 8,
  },
  otherMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECE8FF",
    borderBottomLeftRadius: 8,
  },
  messageUser: {
    fontWeight: "bold",
    marginBottom: 4,
    color: "#4E4D66",
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  myMessageUser: {
    color: "#F3EAFD",
  },
  messageText: {
    fontSize: 16,
    color: "#1C1B2D",
    lineHeight: 22,
  },
  myMessageText: {
    color: "#FDF8FF",
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 10,
    marginTop: 5,
  },
  commentCount: {
    fontSize: 12,
    color: "#7E7BA8",
  },
  commentButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  commentButtonOther: {
    backgroundColor: "rgba(74, 144, 226, 0.12)",
  },
  commentButtonMy: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  commentButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timestamp: {
    fontSize: 12,
    color: "#7C7B92",
  },
  timestampMy: {
    color: "rgba(255,255,255,0.8)",
  },
  inputContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#F5F5F5",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#121826",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIconStack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    gap: 6,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(124, 92, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  recordingBubble: {
    backgroundColor: "#D32F2F",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 15,
    color: "#1F1E33",
    minHeight: 32,
    maxHeight: 104,
    textAlignVertical: "top",
    includeFontPadding: false,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  audioPlayer: {
    marginTop: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  audioText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    color: "#FFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalButton: {
    paddingVertical: 10,
  },
  modalButtonText: {
    fontSize: 16,
    textAlign: "center",
  },
  infoContainer: {
    padding: 10,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  infoText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  memberItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#DDD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberText: {
    fontSize: 16,
  },
  removeButton: {
    backgroundColor: "#D32F2F",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 10,
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  reactionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 6,
  },
  reactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124, 92, 255, 0.12)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reactionItemMy: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  myReaction: {
    borderColor: "#B39DDB",
    borderWidth: 1,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 12,
    marginLeft: 4,
    color: "#575473",
  },
  reactionModalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "70%",
    maxWidth: 300,
  },
  reactionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  reactionOption: {
    padding: 10,
    margin: 5,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  reactionOptionText: {
    fontSize: 24,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    maxWidth: 800,
    maxHeight: 800,
  },
  imageModalCloseButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 1,
  },
  actionModalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "70%",
    maxWidth: 300,
  },
  actionModalButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  actionModalButtonText: {
    fontSize: 16,
    color: "#000",
    textAlign: "center",
  },
  actionModalDestructiveText: {
    fontSize: 16,
    color: "red",
    textAlign: "center",
  },
  // Enhanced reply preview styles for messages
  replyPreviewContainer: {
    flexDirection: "row",
    marginBottom: 10,
    paddingLeft: 10,
  },
  replyLine: {
    width: 3,
    backgroundColor: "#7C5CFF",
    borderRadius: 1.5,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
    backgroundColor: "rgba(124, 92, 255, 0.08)",
    borderRadius: 10,
    padding: 10,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5D5B7A",
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
    color: "#5A5A74",
    lineHeight: 18,
  },
  replyMediaContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 8,
  },
  replyMediaText: {
    fontSize: 13,
    color: "#666",
  },
  // Enhanced reply preview styles for input area
  inputReplyPreview: {
    paddingHorizontal: 12,
    marginHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#00C2FF",
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputReplyLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#00C2FF',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  inputReplyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputReplyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  inputReplyContent: {
    flex: 1,
  },
  inputReplyAuthor: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C2FF",
    flex: 1,
  },
  inputReplyText: {
    fontSize: 13,
    color: "#1565C0",
    lineHeight: 18,
    marginTop: 2,
  },
  replyPreviewMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cancelReplyButton: {
    padding: 4,
    minWidth: 28,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emojiBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "rgba(124, 92, 255, 0.08)",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    gap: 4,
  },
  emojiButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emojiText: {
    fontSize: 24,
  },
})

export default ChannelChatScreen