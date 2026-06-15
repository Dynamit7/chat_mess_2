import { useState, useEffect, useRef, useMemo } from "react";
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
  Linking,
  ScrollView,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import io from "socket.io-client";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "@expo/vector-icons/FontAwesome";
import Icon2 from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from "expo-document-picker";
import { Video } from "expo-av";
import { Audio } from "expo-av";
import root from "../src/proto/group_message_pb";
import { BASE_URL, fixFileUrl } from "../src/config";
import { theme } from "../theme";
import { useTheme } from "../ThemeContext";
import EmojiKeyboard from "../components/EmojiKeyboard";
import ForwardSheet from "../components/ForwardSheet";
import useTranslateMessage from "../helpers/useTranslateMessage";
import PollCreator from "../components/messages/PollCreator";
import PollMessage from "../components/messages/PollMessage";
import VideoCirclePlayer from "../components/messages/VideoCirclePlayer";
import VideoCircleRecorder from "../components/messages/VideoCircleRecorder";
import * as FileSystem from 'expo-file-system';

const chat = root.chat;

// const BASE_URL = Platform.select({
//   web: "http://192.168.77.41:3000",
//   default: "http://192.168.77.41:3000",
// });

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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
];

const isSameDay = (dateA, dateB) =>
  dateA.getFullYear() === dateB.getFullYear() &&
  dateA.getMonth() === dateB.getMonth() &&
  dateA.getDate() === dateB.getDate();

const formatDateLabel = (date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return "Сегодня";
  }
  if (isSameDay(date, yesterday)) {
    return "Вчера";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

const getMimeTypeFromExtension = (fileName) => {
  const ext = fileName.split(".").pop().toLowerCase();
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (["mp4", "mov"].includes(ext)) return "video/mp4";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/m4a";
  if (ext === "webm") return "audio/webm";
  return "application/octet-stream";
};

const clamp = (value, min, max) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

function AudioPlayer({ source }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);

  const handlePlayPause = async () => {
    try {
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(source);
        setSound(newSound);
        await newSound.playAsync();
        setIsPlaying(true);
        setHasFinished(false);
      } else {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          if (hasFinished) {
            await sound.setPositionAsync(0);
            setHasFinished(false);
          }
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error("Ошибка воспроизведения аудио:", error);
    }
  };

  useEffect(() => {
    if (!sound) return;

    const subscription = sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        setIsPlaying(false);
        setHasFinished(true);
      }
    });

    return () => {
      if (sound) {
        sound.setOnPlaybackStatusUpdate(null);
      }
    };
  }, [sound]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  let buttonLabel = "Воспроизвести";
  if (isPlaying) {
    buttonLabel = "Остановить";
  } else if (hasFinished) {
    buttonLabel = "Прослушать снова";
  }

  let playerBgColor = "#E0E0E0";
  if (isPlaying) {
    playerBgColor = "#29B6F6";
  } else if (hasFinished) {
    playerBgColor = "#81C784";
  }

  return (
    <TouchableOpacity
      onPress={handlePlayPause}
      style={[styles.audioPlayer, { backgroundColor: playerBgColor }]}
    >
      <Text style={styles.audioText}>{buttonLabel}</Text>
    </TouchableOpacity>
  );
}

function GroupChatScreen({ route, navigation }) {
  const { isDarkMode } = useTheme();
  const { translations, translateMessage } = useTranslateMessage();
  const { groupId } = route.params;
  const [userId, setUserId] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupOwnerId, setGroupOwnerId] = useState(null);
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const socketRef = useRef(null);
  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [optionList, setOptionList] = useState([]);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef(null);
  const [messageActionModalVisible, setMessageActionModalVisible] =
    useState(false);
  const [actionReactionOpen, setActionReactionOpen] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [readByModalVisible, setReadByModalVisible] = useState(false);
  const [readByUsers, setReadByUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { userId: username }
  const typingTimeoutRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [forwardSheetVisible, setForwardSheetVisible] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [polls, setPolls] = useState({});
  const [groupReactions, setGroupReactions] = useState({}); // { messageId: [{id,userId,emoji}] }
  const [showVideoCircleRecorder, setShowVideoCircleRecorder] = useState(false);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Отслеживаем высоту клавиатуры для динамического отступа
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    console.log("Group Avatar URL:", groupAvatar);
  }, [groupAvatar]);

  const updateLastSeen = async () => {
    try {
      if (!userId || userId === "null" || isNaN(Number(userId))) {
        console.error("Invalid userId for updateLastSeen:", userId);
        return;
      }

      const response = await axios.post(
        `${BASE_URL}/api/groups/${groupId}/update-last-seen`,
        {
          userId: Number(userId),
        }
      );
      console.log(
        `lastSeen updated for group ${groupId}, user ${userId}:`,
        response.data
      );

      navigation.setParams({ hasUnread: false });
      socketRef.current.emit("updateLastSeen", {
        groupId,
        userId: Number(userId),
      });
    } catch (err) {
      console.error(
        "Ошибка при обновлении lastSeen:",
        err.response?.data || err.message
      );
    }
  };

  useEffect(() => {
    (async () => {
      try {
        let storedUserId = await AsyncStorage.getItem("userId");
        if (!storedUserId && Platform.OS === "web") {
          storedUserId = "webUserId";
          await AsyncStorage.setItem("userId", storedUserId);
        }

        if (
          storedUserId &&
          storedUserId !== "null" &&
          !isNaN(Number(storedUserId))
        ) {
          setUserId(Number(storedUserId));
        } else {
          console.warn("Invalid userId found in storage:", storedUserId);
        }
      } catch (error) {
        console.error("Ошибка при загрузке userId:", error);
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    const socketInstance = io(`${BASE_URL}`, {
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
    });
    if (!mounted) { socketInstance.disconnect(); return; }
    socketRef.current = socketInstance;

    socketInstance.on("connect", () => {
      console.log("Socket connected");
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    if (userId && userId !== "null") {
      socketInstance.emit("joinGroup", {
        groupId: String(groupId),
        userId,
      });
      socketInstance.emit("joinRoom", `user_${userId}`);
      updateLastSeen();
    }

    socketInstance.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    socketInstance.on("groupMessageReceived", (data) => {
      try {
        console.log("Received groupMessageReceived data:", data);
        if (!chat.GroupMessage) {
          throw new Error("GroupMessage is undefined in group_message_pb.js");
        }
        let messageData;
        if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
          const decoded = chat.GroupMessage.decode(new Uint8Array(data));
          const decodedReadBy = decoded.readBy ? [...decoded.readBy] : [];
          messageData = decoded.toObject ? decoded.toObject() : decoded;
          messageData.readBy = decodedReadBy; // restore readBy lost by toObject()
          console.log("Decoded message:", messageData);
        } else {
          console.warn("Received non-buffer data:", data);
          messageData = data;
        }
        if (messageData.groupId === Number(groupId)) {
          const messageReadBy =
            messageData.readBy?.length > 0
              ? messageData.readBy
              : [messageData.userId];
          setMessages((prev) => {
            const exists = prev.some((msg) => msg.id === messageData.id);
            if (exists) return prev;
            return [
              ...prev,
              {
                ...messageData,
                repliesCount: 0,
                readBy: messageReadBy,
              },
            ];
          });
          updateLastSeen();

          // If this is a poll message, store the poll data
          if (messageData.type === 'poll' && messageData.poll) {
            setPolls(prev => ({
              ...prev,
              [messageData.id]: messageData.poll,
            }));
          }

          if (messageData.replyToId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageData.replyToId
                  ? { ...msg, repliesCount: (msg.repliesCount || 0) + 1 }
                  : msg
              )
            );
          }
        }
      } catch (err) {
        console.error("Error decoding groupMessageReceived:", err);
      }
    });

    socketInstance.on("groupMessageUpdated", (buffer) => {
      try {
        let updatedMessage;
        if (buffer instanceof ArrayBuffer || buffer instanceof Uint8Array) {
          const decoded = chat.GroupMessage.decode(new Uint8Array(buffer));
          const decodedReadBy = decoded.readBy ? [...decoded.readBy] : [];
          updatedMessage = decoded.toObject ? decoded.toObject() : decoded;
          updatedMessage.readBy = decodedReadBy;
        } else {
          console.warn("Received non-buffer data for groupMessageUpdated:", buffer);
          updatedMessage = buffer;
        }

        if (updatedMessage && updatedMessage.id) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id
                ? { ...updatedMessage, readBy: updatedMessage.readBy?.length > 0 ? updatedMessage.readBy : (msg.readBy || [updatedMessage.userId]) }
                : msg
            )
          );
        }
      } catch (err) {
        console.error("Error decoding groupMessageUpdated:", err);
      }
    });

    socketInstance.on("groupMessageDeleted", ({ messageId }) => {
      setMessages((prev) => {
        const deletedMsg = prev.find((m) => String(m.id) === messageId);
        const newMessages = prev.filter((msg) => String(msg.id) !== messageId);
        if (deletedMsg?.replyToId) {
          return newMessages.map((msg) =>
            msg.id === deletedMsg.replyToId
              ? {
                  ...msg,
                  repliesCount: Math.max(0, (msg.repliesCount || 1) - 1),
                }
              : msg
          );
        }
        return newMessages;
      });
      setSelectedMessages((prev) =>
        prev.filter((id) => String(id) !== messageId)
      );
    });

    socketInstance.on("groupMessagesCleared", (data) => {
      if (String(data.groupId) === String(groupId)) {
        setMessages([]);
        setSelectedMessages([]);
      }
    });

    socketInstance.on("groupReactionAdded", ({ messageId, userId: rUserId, emoji, id }) => {
      setGroupReactions((prev) => {
        const list = prev[messageId] || [];
        if (list.some((r) => r.userId === rUserId && r.emoji === emoji)) return prev;
        return { ...prev, [messageId]: [...list, { id, userId: rUserId, emoji }] };
      });
    });

    socketInstance.on("groupReactionRemoved", ({ messageId, userId: rUserId, emoji }) => {
      setGroupReactions((prev) => {
        const list = (prev[messageId] || []).filter(
          (r) => !(r.userId === rUserId && r.emoji === emoji)
        );
        return { ...prev, [messageId]: list };
      });
    });

    socketInstance.on("groupUpdated", (data) => {
      if (data.groupId === groupId) {
        if (data.updatedFields.name) {
          setGroupName(data.updatedFields.name);
        }
        if (data.updatedFields.images && data.updatedFields.images.length > 0) {
          setGroupAvatar(data.updatedFields.images[0]);
        } else if (data.updatedFields.avatar) {
          setGroupAvatar(data.updatedFields.avatar);
        } else {
          setGroupAvatar(null);
        }
      }
    });

    socketInstance.on("groupDeleted", (data) => {
      if (data.groupId === groupId) {
        Alert.alert("Группа удалена", "Группа была удалена создателем.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    });

    // Обработчик события "печатает" для групп
    socketInstance.on("groupTyping", (data) => {
      console.log('Received groupTyping event:', data);
      
      if (data.isTyping) {
        // Добавляем пользователя в список печатающих
        setTypingUsers(prev => ({
          ...prev,
          [data.userId]: data.username || `User ${data.userId}`
        }));
      } else {
        // Убираем пользователя из списка печатающих
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[data.userId];
          return updated;
        });
      }
    });

    socketInstance.on("messagesRead", (data) => {
      console.log("Received messagesRead event:", data);
      if (Number(data.groupId) === Number(groupId)) {
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) => {
            if (
              data.messageIds.map((id) => String(id)).includes(String(msg.id))
            ) {
              const newReadBy = [
                ...(msg.readBy || []),
                Number(data.userId),
              ].filter((id, index, self) => self.indexOf(id) === index);
              console.log(`Updated readBy for message ${msg.id}:`, newReadBy);
              return { ...msg, readBy: newReadBy };
            }
            return msg;
          });
          return [...updatedMessages];
        });
      }
    });

    // Очистка typing при размонтировании
    const cleanup = () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (socketInstance && userId) {
        socketInstance.emit("typing", {
          userId: Number(userId),
          chatId: null,
          groupId: Number(groupId),
          isTyping: false
        });
      }
      setTypingUsers({});
    };

    if (userId) {
      const lastSeenInterval = setInterval(() => {
        updateLastSeen();
      }, 30000);

      return () => {
        mounted = false;
        cleanup();
        socketInstance.disconnect();
        clearInterval(lastSeenInterval);
      };
    } else {
      return () => {
        mounted = false;
        cleanup();
        socketInstance.disconnect();
      };
    }
  }, [userId, groupId, navigation]);

  useEffect(() => {
    const fetchMessagesAndGroup = async () => {
      try {
        console.log("Protobuf chat object:", chat);
        if (!chat.GroupMessageList) {
          throw new Error(
            "GroupMessageList is undefined in group_message_pb.js"
          );
        }
        if (!chat.GroupMessage) {
          throw new Error("GroupMessage is undefined in group_message_pb.js");
        }

        const userIdParam =
          userId && userId !== "null" ? `?userId=${userId}` : "";
        const resMessages = await axios.get(
          `${BASE_URL}/api/groups/${groupId}/messages${userIdParam}`,
          {
            responseType: "arraybuffer",
          }
        );
        try {
          const messagesBuffer = new Uint8Array(resMessages.data);
          const messagesData = chat.GroupMessageList.decode(messagesBuffer);
          // Capture readBy BEFORE toObject() — toObject() drops the repeated readBy field
          const messagesArray =
            messagesData.messages.map((msg) => {
              const readBy = msg.readBy ? [...msg.readBy] : [];
              const obj = msg.toObject ? msg.toObject() : msg;
              return { ...obj, readBy };
            }) || [];
          const messagesWithReplies = messagesArray.map((msg) => ({
            ...msg,
            repliesCount: messagesArray.filter((m) => m.replyToId === msg.id)
              .length,
            readBy: msg.readBy?.length > 0 ? msg.readBy : [msg.userId],
          }));
          setMessages(messagesWithReplies);

          // Fetch polls for this group
          try {
            const pollsRes = await axios.get(
              `${BASE_URL}/api/polls/group/${groupId}?userId=${userId}`
            );
            if (pollsRes.data?.polls) {
              const pollsMap = {};
              pollsRes.data.polls.forEach(p => {
                if (p.groupMessageId) {
                  pollsMap[p.groupMessageId] = p;
                }
              });
              setPolls(pollsMap);
            }
          } catch (pollErr) {
            console.log("Could not fetch polls:", pollErr.message);
          }

          // Fetch reactions for this group
          try {
            const reactRes = await axios.get(`${BASE_URL}/api/groups/${groupId}/reactions`);
            if (reactRes.data) setGroupReactions(reactRes.data);
          } catch (_) {}
        } catch (decodeError) {
          console.error("Failed to decode Protobuf:", decodeError);
          Alert.alert("Ошибка", "Не удалось загрузить сообщения группы");
          setMessages([]);
        }

        const resGroup = await axios.get(
          `${BASE_URL}/api/groups/id/${groupId}`
        );
        const groupData = resGroup.data;
        setGroupOwnerId(groupData.ownerId);
        setGroupName(groupData.name);
        if (groupData.images && groupData.images.length > 0) {
          setGroupAvatar(groupData.images[0]);
        } else if (groupData.avatar) {
          setGroupAvatar(groupData.avatar);
        } else {
          setGroupAvatar(null);
        }

        updateLastSeen();
      } catch (err) {
        console.error(
          "Ошибка при загрузке сообщений/группы:",
          err.response?.data || err.message
        );
        Alert.alert("Ошибка", "Не удалось загрузить данные группы");
        setMessages([]);
      }
    };
    if (userId) {
      fetchMessagesAndGroup();
    }
  }, [groupId, userId]);

  const scrollToMessage = (messageId) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  };

  const startRecording = async () => {
    if (Platform.OS === "web") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        Alert.alert("Ошибка", "Ваш браузер не поддерживает запись звука.");
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudioInput = devices.some(
          (device) => device.kind === "audioinput"
        );
        if (!hasAudioInput) {
          Alert.alert("Ошибка", "Микрофон не найден.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        let chunks = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const file = new File([blob], "voice_message.webm", {
            type: "audio/webm",
          });
          handleSendFile(file);
          chunks = [];
          stream.getTracks().forEach((track) => track.stop());
        };
        mediaRecorder.start();
        setRecording(mediaRecorder);
        setIsRecording(true);
      } catch (err) {
        console.error("Ошибка записи в веб:", err);
        Alert.alert("Ошибка записи", "Не удалось начать запись.");
      }
    } else {
      try {
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Нет разрешения", "Нужно дать доступ к микрофону");
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const newRecording = new Audio.Recording();
        await newRecording.prepareToRecordAsync(
          Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
        );
        await newRecording.startAsync();
        setRecording(newRecording);
        setIsRecording(true);
      } catch (err) {
        console.error("Ошибка при старте записи:", err);
        Alert.alert("Ошибка", "Не удалось начать запись");
      }
    }
  };

  const stopRecording = async () => {
    if (Platform.OS === "web") {
      if (recording && recording.state === "recording") {
        recording.stop();
        setIsRecording(false);
        setRecording(null);
      }
    } else {
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setIsRecording(false);
        setRecording(null);
        const file = {
          uri: uri,
          name: "voice_message.m4a",
          type: "audio/m4a",
        };
        handleSendFile(file);
      } catch (err) {
        console.error("Ошибка при остановке записи:", err);
        Alert.alert("Ошибка", "Не удалось остановить запись");
      }
    }
  };

  // Функция для обработки изменения текста с отправкой события "печатает" для групп
  const handleTextChange = (text) => {
    setNewMessage(text);
    
    if (!userId || !groupId) return;
    
    const socketInstance = socketRef.current;
    if (!socketInstance) return;
    
    // Отправляем событие "печатает" для групп
    if (text.length > 0) {
      socketInstance.emit("typing", {
        userId: Number(userId),
        chatId: null,
        groupId: Number(groupId),
        isTyping: true
      });
      
      // Сбрасываем предыдущий таймаут
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Устанавливаем новый таймаут для остановки "печатает" через 2 секунды
      typingTimeoutRef.current = setTimeout(() => {
        socketInstance.emit("typing", {
          userId: Number(userId),
          chatId: null,
          groupId: Number(groupId),
          isTyping: false
        });
        typingTimeoutRef.current = null;
      }, 2000);
    } else {
      // Если текст пустой, отправляем остановку
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      socketInstance.emit("typing", {
        userId: Number(userId),
        chatId: null,
        groupId: Number(groupId),
        isTyping: false
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !replyingTo) return;

    if (!userId || userId === "null") {
      Alert.alert("Ошибка", "Не удалось определить пользователя");
      return;
    }

    try {
      if (editingMessage) {
        await axios.put(
          `${BASE_URL}/api/groups/${groupId}/message/${editingMessage.id}`,
          {
            userId: Number(userId),
            text: newMessage,
          }
        );
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === editingMessage.id ? { ...msg, text: newMessage, isEdited: true } : msg
          )
        );
        setEditingMessage(null);
        setNewMessage("");
        updateLastSeen();
      } else {
        // Отправляем событие остановки печатания перед отправкой сообщения
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        const socketInstance = socketRef.current;
        if (socketInstance) {
          socketInstance.emit("typing", {
            userId: Number(userId),
            chatId: null,
            groupId: Number(groupId),
            isTyping: false
          });
        }

        const payload = {
          userId: Number(userId),
          text: newMessage,
          replyToId: replyingTo ? replyingTo.id : null,
        };
        await axios.post(`${BASE_URL}/api/groups/${groupId}/message`, payload);
        setNewMessage("");
        setReplyingTo(null);
        updateLastSeen();
      }
    } catch (error) {
      console.error(
        "Ошибка при отправке/редактировании сообщения:",
        error.response?.data || error.message
      );
      Alert.alert("Ошибка", "Не удалось отправить/отредактировать сообщение");
    }
    setSelectedMessage(null);
    setSelectedMessages([]);
  };

  const handleSendFile = async (file, isUpdate = false) => {
    if (!userId || userId === "null") {
      Alert.alert("Ошибка", "Не удалось определить пользователя");
      return;
    }

    const formData = new FormData();
    if (Platform.OS === "web" && file.uri) {
      try {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const newFile = new File([blob], file.name || "file", {
          type:
            file.type ||
            blob.type ||
            getMimeTypeFromExtension(file.name) ||
            "application/octet-stream",
        });
        formData.append("file", newFile);
      } catch (err) {
        console.error("Ошибка blob в веб:", err);
        Alert.alert("Ошибка", "Не удалось обработать файл");
        return;
      }
    } else if (file.uri) {
      const mimeType = getMimeTypeFromExtension(file.name);
      formData.append("file", {
        uri: file.uri,
        name: file.name || "file",
        type: mimeType,
      });
    } else if (file instanceof File) {
      formData.append("file", file);
    }

    formData.append("userId", Number(userId));
    formData.append("text", "");
    if (replyingTo && !isUpdate) {
      formData.append("replyToId", replyingTo.id);
    }

    try {
      if (isUpdate && editingMessage) {
        await axios.put(
          `${BASE_URL}/api/groups/${groupId}/message/${editingMessage.id}`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        const resMessages = await axios.get(
          `${BASE_URL}/api/groups/${groupId}/messages${userId ? `?userId=${userId}` : ""}`,
          {
            responseType: "arraybuffer",
          }
        );
        const messagesBuffer = new Uint8Array(resMessages.data);
        const messagesDecoded = chat.GroupMessageList.decode(messagesBuffer);
        const messagesArray = messagesDecoded.messages.map((msg) => {
          const readBy = msg.readBy ? [...msg.readBy] : [];
          const obj = msg.toObject ? msg.toObject() : msg;
          return { ...obj, readBy };
        }) || [];
        setMessages(
          messagesArray.map((msg) => ({
            ...msg,
            repliesCount: messagesArray.filter((m) => m.replyToId === msg.id)
              .length,
            readBy: msg.readBy?.length > 0 ? msg.readBy : [msg.userId],
          }))
        );
        setEditingMessage(null);
      } else {
        await axios.post(
          `${BASE_URL}/api/groups/${groupId}/message`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        setReplyingTo(null);
      }
      updateLastSeen();
    } catch (err) {
      console.error(
        "Ошибка при отправке файла:",
        err.response?.data || err.message
      );
      Alert.alert("Ошибка", "Не удалось отправить файл");
    }
    setSelectedMessages([]);
  };

  const handleVideoCircleRecorded = async (videoUri) => {
    if (!userId || userId === "null") return;
    try {
      console.log('Uploading group video circle from:', videoUri);
      const uploadResult = await FileSystem.uploadAsync(
        `${BASE_URL}/api/groups/${groupId}/message`,
        videoUri,
        {
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'video/mp4',
          parameters: {
            userId: String(userId),
            text: '',
            messageType: 'video_circle',
          },
        }
      );
      console.log('Group video circle upload status:', uploadResult.status);
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        console.error('Upload failed:', uploadResult.status, uploadResult.body);
        Alert.alert("Ошибка", "Не удалось отправить видеокружок");
      }
    } catch (err) {
      console.error("Error sending video circle:", err);
      Alert.alert("Ошибка", "Не удалось отправить видеокружок");
    } finally {
      setShowVideoCircleRecorder(false);
    }
  };

  const pickFile = async (isUpdate = false) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        handleSendFile(file, isUpdate);
      }
    } catch (err) {
      console.error("Ошибка при выборе файла:", err);
      Alert.alert("Ошибка", "Не удалось выбрать файл");
    }
  };

  const leaveGroup = async () => {
    try {
      if (!userId || userId === "null") {
        Alert.alert("Ошибка", "Не удалось определить пользователя");
        return;
      }
      await axios.delete(`${BASE_URL}/api/groups/${groupId}/leave`, {
        data: { userId },
      });
      navigation.goBack();
    } catch (err) {
      console.error(
        "Ошибка при выходе из группы:",
        err.response?.data || err.message
      );
      Alert.alert("Ошибка", "Не удалось выйти из группы");
    }
  };

  const deleteGroup = async () => {
    try {
      if (!userId || userId === "null") {
        Alert.alert("Ошибка", "Не удалось определить пользователя");
        return;
      }
      await axios.delete(`${BASE_URL}/api/groups/${groupId}`, {
        data: { userId },
      });
      navigation.goBack();
    } catch (err) {
      console.error(
        "Ошибка при удалении группы:",
        err.response?.data || err.message
      );
      Alert.alert("Ошибка", "Не удалось удалить группу");
    }
  };

  const clearMessages = async () => {
    try {
      if (!userId || userId === "null") {
        Alert.alert("Ошибка", "Не удалось определить пользователя");
        return;
      }
      setNewMessage("");
      setMessages([]);
      setSelectedMessages([]);
      await axios.delete(`${BASE_URL}/api/groups/${groupId}/messages`, {
        data: { userId },
      });
    } catch (err) {
      console.error(
        "Ошибка при очистке сообщений:",
        err.response?.data || err.message
      );
      Alert.alert("Ошибка", "Не удалось очистить сообщения");
    }
  };

  const reportGroup = async () => {
    try {
      if (!userId || userId === "null") {
        Alert.alert("Ошибка", "Не удалось определить пользователя");
        return;
      }
      await axios.post(`${BASE_URL}/api/groups/${groupId}/report`, {
        userId,
      });
      Alert.alert("Жалоба", "Ваша жалоба принята!");
    } catch (err) {
      console.error(
        "Ошибка при отправке жалобы:",
        err.response?.data || err.message
      );
      Alert.alert("Ошибка", "Не удалось отправить жалобу");
    }
  };

  const showGroupOptions = () => {
    // Если есть выбранные сообщения
    if (selectedMessages.length > 0) {
      // Если выбрано одно сообщение - показываем редактирование и удаление
      if (selectedMessages.length === 1) {
        const selectedMessageId = selectedMessages[0];
        const selectedMessage = messages.find((m) => m.id === selectedMessageId);
        const canEdit = selectedMessage && selectedMessage.userId == userId;
        
        if (Platform.OS === "web") {
          const options = [];
          
          if (canEdit) {
            options.push({
              text: "Редактировать",
              onPress: () => {
                setOptionModalVisible(false);
                handleInitiateEditMessage(selectedMessage);
              },
            });
          }
          
          options.push(
            {
              text: "Переслать",
              onPress: () => {
                setOptionModalVisible(false);
                setMessageToForward({
                  id: selectedMessage.id,
                  sourceType: 'group',
                  text: selectedMessage.text || '',
                  type: selectedMessage.type || 'text',
                  fileUrl: selectedMessage.fileUrl || null,
                  filename: selectedMessage.filename || null,
                  senderUsername: selectedMessage.sender?.username || '',
                });
                setForwardSheetVisible(true);
                setSelectedMessages([]);
              },
            },
            {
              text: "Удалить",
              onPress: () => {
                setOptionModalVisible(false);
                handleDeleteMessages();
              },
              style: "destructive",
            },
            {
              text: "Отмена",
              onPress: () => {
                setOptionModalVisible(false);
                setSelectedMessages([]);
              },
              style: "cancel",
            }
          );

          setOptionList(options);
          setOptionModalVisible(true);
        } else {
          const alertOptions = [];

          if (canEdit) {
            alertOptions.push({
              text: "Редактировать",
              onPress: () => {
                handleInitiateEditMessage(selectedMessage);
                setSelectedMessages([]);
              },
            });
          }

          alertOptions.push(
            {
              text: "Переслать",
              onPress: () => {
                setMessageToForward({
                  id: selectedMessage.id,
                  sourceType: 'group',
                  text: selectedMessage.text || '',
                  type: selectedMessage.type || 'text',
                  fileUrl: selectedMessage.fileUrl || null,
                  filename: selectedMessage.filename || null,
                  senderUsername: selectedMessage.sender?.username || '',
                });
                setForwardSheetVisible(true);
                setSelectedMessages([]);
              },
            },
            {
              text: "Удалить",
              onPress: () => {
                handleDeleteMessages();
              },
              style: "destructive",
            },
            {
              text: "Отмена",
              onPress: () => setSelectedMessages([]),
              style: "cancel",
            }
          );
          
          Alert.alert("Выберите действие", "", alertOptions);
        }
        return;
      }
      
      // Если выбрано больше одного сообщения - показываем удаление и пересылку
      const firstMsg = messages.find((m) => m.id === selectedMessages[0]);
      if (Platform.OS === "web") {
        const multiOptions = [];
        if (firstMsg) {
          multiOptions.push({
            text: "Переслать",
            onPress: () => {
              setOptionModalVisible(false);
              setMessageToForward({
                id: firstMsg.id,
                sourceType: 'group',
                text: firstMsg.text || '',
                type: firstMsg.type || 'text',
                fileUrl: firstMsg.fileUrl || null,
                filename: firstMsg.filename || null,
                senderUsername: firstMsg.sender?.username || '',
              });
              setForwardSheetVisible(true);
              setSelectedMessages([]);
            },
          });
        }
        multiOptions.push(
          {
            text: `Удалить выбранные (${selectedMessages.length})`,
            onPress: () => {
              setOptionModalVisible(false);
              handleDeleteMessages();
            },
            style: "destructive",
          },
          {
            text: "Отмена",
            onPress: () => {
              setOptionModalVisible(false);
              setSelectedMessages([]);
            },
            style: "cancel",
          }
        );
        setOptionList(multiOptions);
        setOptionModalVisible(true);
      } else {
        const multiAlertOptions = [];
        if (firstMsg) {
          multiAlertOptions.push({
            text: "Переслать",
            onPress: () => {
              setMessageToForward({
                id: firstMsg.id,
                sourceType: 'group',
                text: firstMsg.text || '',
                type: firstMsg.type || 'text',
                fileUrl: firstMsg.fileUrl || null,
                filename: firstMsg.filename || null,
                senderUsername: firstMsg.sender?.username || '',
              });
              setForwardSheetVisible(true);
              setSelectedMessages([]);
            },
          });
        }
        multiAlertOptions.push(
          {
            text: `Удалить выбранные (${selectedMessages.length})`,
            onPress: handleDeleteMessages,
            style: "destructive",
          },
          {
            text: "Отмена",
            onPress: () => setSelectedMessages([]),
            style: "cancel",
          }
        );
        Alert.alert("Выберите действие", "", multiAlertOptions);
      }
      return;
    }

    // Обычное меню опций группы
    if (Platform.OS === "web") {
      if (groupOwnerId && groupOwnerId == userId) {
        setOptionList([
          {
            text: "Удалить группу",
            onPress: () => {
              setOptionModalVisible(false);
              deleteGroup();
            },
            style: "destructive",
          },
          {
            text: "Очистить все сообщения",
            onPress: () => {
              setOptionModalVisible(false);
              clearMessages();
            },
          },
          {
            text: "Отмена",
            onPress: () => setOptionModalVisible(false),
            style: "cancel",
          },
        ]);
      } else {
        setOptionList([
          {
            text: "Выйти из группы",
            onPress: () => {
              setOptionModalVisible(false);
              leaveGroup();
            },
          },
          {
            text: "Пожаловаться",
            onPress: () => {
              setOptionModalVisible(false);
              reportGroup();
            },
          },
          {
            text: "Отмена",
            onPress: () => setOptionModalVisible(false),
            style: "cancel",
          },
        ]);
      }
      setOptionModalVisible(true);
    } else {
      if (groupOwnerId && groupOwnerId == userId) {
        Alert.alert("Выберите действие", "", [
          {
            text: "Удалить группу",
            onPress: deleteGroup,
            style: "destructive",
          },
          { text: "Очистить все сообщения", onPress: clearMessages },
          { text: "Отмена", style: "cancel" },
        ]);
      } else {
        Alert.alert("Выберите действие", "", [
          { text: "Выйти из группы", onPress: leaveGroup },
          { text: "Пожаловаться", onPress: reportGroup },
          { text: "Отмена", style: "cancel" },
        ]);
      }
    }
  };

  const handleDeleteMessages = async () => {
    if (!userId || userId === "null") {
      Alert.alert("Ошибка", "Не удалось определить пользователя");
      return;
    }
    try {
      for (const messageId of selectedMessages) {
        const message = messages.find((m) => m.id === messageId);
        if (message && (groupOwnerId == userId || message.userId == userId)) {
          await axios.delete(
            `${BASE_URL}/api/groups/${groupId}/message/${messageId}`,
            { data: { userId } }
          );
        }
      }
      setMessages((prev) => {
        const newMessages = prev.filter(
          (msg) => !selectedMessages.includes(msg.id)
        );
        const updatedMessages = newMessages.map((msg) => {
          if (selectedMessages.includes(msg.replyToId)) {
            return {
              ...msg,
              repliesCount: Math.max(0, (msg.repliesCount || 1) - 1),
            };
          }
          return msg;
        });
        return updatedMessages;
      });
      setSelectedMessages([]);
      setMessageActionModalVisible(false);
    } catch (error) {
      console.error(
        "Ошибка при удалении сообщений:",
        error.response?.data || error.message
      );
      Alert.alert("Ошибка", "Не удалось удалить сообщения");
    }
  };

  const handleInitiateEditMessage = (message) => {
    if (message.userId == userId) {
      if (message.type === "text") {
        setNewMessage(message.text || "");
        setEditingMessage(message);
      } else if (message.type === "image") {
        setEditingMessage(message);
        pickFile(true);
      } else {
        Alert.alert(
          "Редактирование не поддерживается",
          "Можно редактировать только текстовые сообщения и изображения."
        );
      }
      setSelectedMessage(null);
      setSelectedMessages([]);
      setMessageActionModalVisible(false);
    } else {
      Alert.alert("Нет прав", "Вы не можете редактировать это сообщение.");
    }
  };

  const handleGroupReact = async (messageId, emoji) => {
    if (!userId) return;
    try {
      await axios.post(`${BASE_URL}/api/groups/${groupId}/messages/${messageId}/react`, {
        userId: Number(userId),
        emoji,
      });
    } catch (err) {
      console.error("group react error:", err.message);
    }
  };

  const handleLongPressMessage = (message) => {
    console.log("Long press detected on message:", message.id);
    setSelectedMessages((prev) =>
      prev.includes(message.id)
        ? prev.filter((id) => id !== message.id)
        : [...prev, message.id]
    );
    setSelectedMessage(null);
    setMessageActionModalVisible(false);
  };

  const handlePressMessage = (message) => {
    if (selectedMessages.length > 0) {
      setSelectedMessages((prev) =>
        prev.includes(message.id)
          ? prev.filter((id) => id !== message.id)
          : [...prev, message.id]
      );
    } else {
      setSelectedMessage(message);
      // Формируем список опций для модального окна
      const actionOptions = [
        {
          text: "Ответить",
          onPress: () => {
            setReplyingTo(message);
            setMessageActionModalVisible(false);
            setSelectedMessage(null);
          },
        },
        {
          text: "Переслать",
          onPress: () => {
            setMessageToForward({
              id: message.id,
              sourceType: 'group',
              text: message.text || '',
              type: message.type || 'text',
              fileUrl: message.fileUrl || null,
              filename: message.filename || null,
              senderUsername: message.sender?.username || '',
            });
            setForwardSheetVisible(true);
            setMessageActionModalVisible(false);
            setSelectedMessage(null);
          },
        },
      ];
      // Добавляем опцию "Редактировать" только для собственных сообщений
      if (message.userId == userId) {
        actionOptions.push({
          text: "Редактировать",
          onPress: () => handleInitiateEditMessage(message),
        });
      }
      // Добавляем опцию "Прочитано" только для собственных сообщений
      if (message.userId == userId) {
        actionOptions.push({
          text: "Прочитано",
          onPress: () => handleShowReadBy(message),
          icon: <Icon name="users" size={16} color="#333" />,
        });
      }
      actionOptions.push({
        text: "😊  Реакции",
        onPress: () => setActionReactionOpen(true),
      });
      actionOptions.push({
        text: "Отмена",
        onPress: () => {
          setMessageActionModalVisible(false);
          setSelectedMessage(null);
          setActionReactionOpen(false);
        },
        style: "cancel",
      });
      // Устанавливаем опции и показываем модальное окно
      setActionReactionOpen(false);
      setOptionList(actionOptions);
      setMessageActionModalVisible(true);
    }
  };

  const handleImagePress = (fileUrl) => {
    const fixed = fixFileUrl(fileUrl);
    const imageUrl = fixed.startsWith("http://") || fixed.startsWith("https://")
      ? fixed
      : `${BASE_URL}${fixed}`;
    setSelectedImageUrl(imageUrl);
    setImageModalVisible(true);
  };

  const handleRepliesPress = (messageId) => {
    const firstReply = messages.find((m) => m.replyToId === messageId);
    if (firstReply) {
      scrollToMessage(firstReply.id);
      setSelectedMessage(firstReply);
      setTimeout(() => setSelectedMessage(null), 2000);
    }
  };

  const handleSwipeToReply = (messageId) => {
    // Находим сообщение по ID
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setReplyingTo(message);
      setMessageActionModalVisible(false);
      setSelectedMessage(null);
    }
  };

  const handleShowReadBy = async (message) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/groups/members/${groupId}`);
      const groupMembers = response.data;
      const readByUserIds = message.readBy || [message.userId];
      const readByUsersData = groupMembers.filter(member => 
        readByUserIds.includes(Number(member.id))
      );
      setReadByUsers(readByUsersData);
      setReadByModalVisible(true);
      setMessageActionModalVisible(false);
      setSelectedMessage(null);
    } catch (err) {
      console.error("Ошибка при получении списка прочитавших:", err);
      Alert.alert("Ошибка", "Не удалось загрузить список прочитавших");
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleInsertEmoji = (emoji) => {
    setNewMessage((prev) => (prev || "") + emoji);
  };

  const chatItems = useMemo(() => {
    const items = [];
    let lastDateLabel = null;

    messages.forEach((message, index) => {
      const createdAt = message.createdAt ? new Date(message.createdAt) : null;
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        const currentLabel = formatDateLabel(createdAt);
        if (currentLabel !== lastDateLabel) {
          lastDateLabel = currentLabel;
          items.push({
            type: "date",
            id: `date-${createdAt.toISOString().split("T")[0]}-${index}`,
            label: currentLabel,
          });
        }
      }

      items.push({ type: "message", data: message });
    });

    return items;
  }, [messages]);

  // Автоматический скролл вниз при появлении новых сообщений
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const renderItem = ({ item }) => {
    if (item.type === "date") {
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateChip}>
            <Text style={styles.dateChipText}>{item.label}</Text>
          </View>
        </View>
      );
    }

    const message = item.data;
    const isMyMessage = message.userId == userId;
    const isSelected = selectedMessages.includes(message.id);
    const repliedMessage = message.replyToId
      ? messages.find((m) => m.id === message.replyToId)
      : null;
    const readBy = message.readBy || [message.userId];
    const isRead =
      readBy.length > 1 ||
      (readBy.length === 1 && !readBy.includes(Number(userId)));

    return (
      <GroupMessageBubble
        item={message}
        isMyMessage={isMyMessage}
        isSelected={isSelected}
        repliedMessage={repliedMessage}
        isRead={isRead}
        isDarkMode={isDarkMode}
        onPressMessage={handlePressMessage}
        onLongPressMessage={handleLongPressMessage}
        onSwipeToReply={handleSwipeToReply}
        onImagePress={handleImagePress}
        onRepliesPress={handleRepliesPress}
        multiSelectActive={selectedMessages.length > 0}
        translation={translations?.[message.id]}
        onTranslate={translateMessage}
        pollData={message.type === 'poll' ? (message.poll || polls[message.id]) : null}
        reactions={groupReactions[message.id] || []}
        onReact={(emoji) => handleGroupReact(message.id, emoji)}
        currentUserId={Number(userId)}
      />
    );
  };

  const getInitialLetter = () => {
    return groupName ? groupName.charAt(0).toUpperCase() : "G";
  };

  return (
    <Pressable
      onPress={() => {
        setSelectedMessage(null);
        setSelectedMessages([]);
        setMessageActionModalVisible(false);
        setImageModalVisible(false);
        setReadByModalVisible(false);
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="angle-left" size={30} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerMiddle}>
            {groupAvatar ? (
              <Image
                source={{
                  uri: groupAvatar && (groupAvatar.startsWith("http://") || groupAvatar.startsWith("https://"))
                    ? groupAvatar
                    : `${BASE_URL}${groupAvatar}?t=${Date.now()}`,
                }}
                style={styles.avatar}
                onError={(e) => {
                  console.error("Avatar load error:", e.nativeEvent.error);
                  setGroupAvatar(null);
                }}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {getInitialLetter()}
                </Text>
              </View>
            )}

            <View style={{ marginLeft: 10 }}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("GroupProfileScreen", { groupId })
                }
              >
                <Text style={styles.username}>{groupName || "Group Chat"}</Text>
              </TouchableOpacity>
              <Text style={styles.groupInfo}>
                {Object.keys(typingUsers).length > 0
                  ? Object.values(typingUsers).join(", ") + " печатает..."
                  : `ID: ${groupId}`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={showGroupOptions}
          >
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
              });
            }}
          />
        </View>
        <View>
        <View style={[
          styles.inputContainer,
          {
            backgroundColor: isDarkMode ? '#0B0F19' : (theme.colors.white || '#FFFFFF'),
            paddingTop: 8,
            paddingBottom: showEmojiPicker ? 0 : (Platform.OS === 'android'
              ? (insets.bottom || 0) + (keyboardHeight > 0 ? 12 : 0)
              : insets.bottom || 0),
          }
        ]}>
          {replyingTo && (
            <View style={styles.replyPreviewContainer}>
              <View style={styles.replyBorder} />
              <View style={styles.replyPreviewHeader}>
                <View style={styles.replyPreviewHeaderLeft}>
                  <Icon name="mail-reply" size={14} color="#00C2FF" style={{ marginRight: 6 }} />
                  <Text style={styles.replyPreviewUsername} numberOfLines={1}>
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
                <Text style={styles.replyPreviewText} numberOfLines={2}>
                  {replyingTo.text}
                </Text>
              ) : replyingTo.type === "image" ? (
                <View style={styles.replyPreviewMedia}>
                  <Icon name="picture-o" size={14} color="#00C2FF" style={{ marginRight: 4 }} />
                  <Text style={styles.replyPreviewText}>Фото</Text>
                </View>
              ) : replyingTo.type === "video" ? (
                <View style={styles.replyPreviewMedia}>
                  <Icon name="video-camera" size={14} color="#00C2FF" style={{ marginRight: 4 }} />
                  <Text style={styles.replyPreviewText}>Видео</Text>
                </View>
              ) : replyingTo.type === "audio" ? (
                <View style={styles.replyPreviewMedia}>
                  <Icon name="microphone" size={14} color="#00C2FF" style={{ marginRight: 4 }} />
                  <Text style={styles.replyPreviewText}>Голосовое сообщение</Text>
                </View>
              ) : (
                <View style={styles.replyPreviewMedia}>
                  <Icon name="paperclip" size={14} color="#00C2FF" style={{ marginRight: 4 }} />
                  <Text style={styles.replyPreviewText}>Файл</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.innerContainer}>
            <View style={[styles.inputAndMicrophone, isDarkMode && { backgroundColor: '#121826' }]}>
              <TouchableOpacity
                style={styles.emoticonButton}
                onPress={() => {
                  if (showEmojiPicker) {
                    setShowEmojiPicker(false);
                  } else {
                    Keyboard.dismiss();
                    setTimeout(() => setShowEmojiPicker(true), 200);
                  }
                }}
              >
                <Icon name="smile-o" size={23} color={theme.colors.description} />
              </TouchableOpacity>

              <TextInput
                style={[styles.textInput, isDarkMode && { color: '#e0e0e0' }]}
                placeholder={
                  editingMessage
                    ? "Редактировать сообщение..."
                    : "Сообщение..."
                }
                placeholderTextColor={isDarkMode ? '#666' : (theme.colors.description || "#999")}
                value={newMessage}
                onChangeText={handleTextChange}
                multiline
                maxLength={4096}
                textAlignVertical="top"
                includeFontPadding={false}
                onFocus={() => {
                  setShowEmojiPicker(false);
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
                onBlur={() => {
                  // Останавливаем печатание при потере фокуса
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = null;
                  }
                  const socketInstance = socketRef.current;
                  if (socketInstance && userId && groupId) {
                    socketInstance.emit("typing", {
                      userId: Number(userId),
                      chatId: null,
                      groupId: Number(groupId),
                      isTyping: false
                    });
                  }
                }}
              />

              <TouchableOpacity
                style={styles.rightIconButtonStyle}
                onPress={() => {
                  Keyboard.dismiss();
                  setAttachMenuVisible(true);
                }}
              >
                <Icon2 name="plus-circle-outline" size={25} color={isDarkMode ? 'rgba(255,255,255,0.55)' : '#64748B'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rightIconButtonStyle}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Icon
                  name={isRecording ? "stop" : "microphone"}
                  size={23}
                  color={isRecording ? theme.colors.danger : (isDarkMode ? 'rgba(255,255,255,0.55)' : '#64748B')}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendMessage}
            >
              <Icon2 name="send" size={23} color="#fff" />
            </TouchableOpacity>
          </View>

        </View>
        {showEmojiPicker && (
          <EmojiKeyboard onEmojiSelect={handleInsertEmoji} onClose={() => setShowEmojiPicker(false)} height={280} />
        )}
        </View>
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
                  <Text
                    style={[
                      styles.modalButtonText,
                      isDarkMode && { color: '#e0e0e0' },
                      option.style === "destructive" && { color: "red" },
                      option.style === "cancel" && { color: isDarkMode ? '#888' : '#666' },
                    ]}
                  >
                    {option.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={messageActionModalVisible && !!selectedMessage}
          transparent
          animationType="fade"
          onRequestClose={() => { setMessageActionModalVisible(false); setSelectedMessage(null); setActionReactionOpen(false); }}
        >
          <Pressable style={styles.modalOverlay} onPress={() => { setMessageActionModalVisible(false); setSelectedMessage(null); setActionReactionOpen(false); }}>
            <View style={[styles.actionModalContent, isDarkMode && { backgroundColor: '#121826' }]}>
              {/* Emoji strip — раскрывается по нажатию «Реакции» */}
              {actionReactionOpen && (
                <>
                  <View style={actionReactStyles.strip}>
                    {GROUP_EMOJIS.map((emoji) => {
                      const mine = selectedMessage && (groupReactions[selectedMessage.id] || []).some(
                        (r) => r.emoji === emoji && r.userId === Number(userId)
                      );
                      return (
                        <TouchableOpacity
                          key={emoji}
                          style={[actionReactStyles.emojiBtn, mine && actionReactStyles.emojiBtnActive]}
                          onPress={() => {
                            if (selectedMessage) handleGroupReact(selectedMessage.id, emoji);
                            setMessageActionModalVisible(false);
                            setSelectedMessage(null);
                            setActionReactionOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={actionReactStyles.emojiText}>{emoji}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={actionReactStyles.divider} />
                </>
              )}
              {optionList.map((option, index) => (
                <TouchableOpacity key={index} style={styles.actionModalButton} onPress={option.onPress}>
                  <Text
                    style={[
                      styles.actionModalButtonText,
                      isDarkMode && { color: '#e0e0e0' },
                      option.style === "destructive" && { color: "red" },
                      option.style === "cancel" && { color: isDarkMode ? '#888' : '#666' },
                    ]}
                  >
                    {option.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={readByModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReadByModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setReadByModalVisible(false)}>
            <View style={[styles.modalContainer, { maxHeight: 300 }, isDarkMode && { backgroundColor: '#121826' }]}>
              <Text style={[styles.modalButtonText, { fontWeight: 'bold', marginBottom: 10 }, isDarkMode && { color: '#e0e0e0' }]}>
                Прочитано пользователями:
              </Text>
              <FlatList
                data={readByUsers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <Text style={[styles.modalButtonText, isDarkMode && { color: '#e0e0e0' }]}>
                    {item.username || `User ${item.id}`}
                  </Text>
                )}
                style={{ maxHeight: 200 }}
              />
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setReadByModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: isDarkMode ? '#888' : '#666' }]}>
                  Закрыть
                </Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.imageModalCloseButton}
                onPress={() => setImageModalVisible(false)}
              >
                <Icon name="times" size={30} color="#fff" />
              </TouchableOpacity>
              <Image
                source={{ uri: selectedImageUrl }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                onError={(e) =>
                  console.error(
                    `Full screen image load error for ${selectedImageUrl}:`,
                    e.nativeEvent.error
                  )
                }
              />
            </View>
          </Modal>
        )}
      <ForwardSheet
        visible={forwardSheetVisible && !!messageToForward}
        onClose={() => {
          setForwardSheetVisible(false);
          setMessageToForward(null);
        }}
        messageToForward={messageToForward}
        currentUserId={userId ? Number(userId) : null}
        isDarkMode={isDarkMode}
      />

      {/* Poll Creator Modal */}
      <Modal
        visible={showPollCreator}
        animationType="slide"
        onRequestClose={() => setShowPollCreator(false)}
      >
        <PollCreator
          groupId={Number(groupId)}
          onClose={() => setShowPollCreator(false)}
          onPollCreated={(poll) => {
            // Poll message will arrive via socket, no need to add manually
            setShowPollCreator(false);
          }}
        />
      </Modal>

      {/* Video Circle Recorder */}
      <VideoCircleRecorder
        visible={showVideoCircleRecorder}
        onClose={() => setShowVideoCircleRecorder(false)}
        onVideoRecorded={handleVideoCircleRecorded}
      />

      {/* Attachment menu */}
      <Modal
        visible={attachMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.attachBackdrop}
          activeOpacity={1}
          onPress={() => setAttachMenuVisible(false)}
        >
          <View style={[styles.attachSheet, { backgroundColor: isDarkMode ? '#121826' : '#FFFFFF' }]}>
            <View style={styles.attachHandle} />
            <View style={styles.attachGrid}>
              {[
                { icon: 'paperclip', label: 'Файл', color: '#7C5CFF', onPress: () => pickFile() },
                { icon: 'poll', label: 'Опрос', color: '#00C2FF', onPress: () => setShowPollCreator(true) },
                { icon: 'circle-slice-8', label: 'Кружок', color: '#F59E0B', onPress: () => setShowVideoCircleRecorder(true) },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.attachItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setAttachMenuVisible(false);
                    setTimeout(() => item.onPress && item.onPress(), 250);
                  }}
                >
                  <View style={[styles.attachIconCircle, { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}>
                    <Icon2 name={item.icon} size={26} color={item.color} />
                  </View>
                  <Text style={[styles.attachLabel, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const GROUP_EMOJIS = ['👍', '❤️', '🔥', '👏', '😮', '😢', '😡', '🎉'];


const GroupMessageBubble = ({
  item,
  isMyMessage,
  isSelected,
  repliedMessage,
  isRead,
  isDarkMode,
  onPressMessage,
  onLongPressMessage,
  onSwipeToReply,
  onImagePress,
  onRepliesPress,
  multiSelectActive,
  translation,
  onTranslate,
  pollData,
  reactions = [],
  onReact,
  currentUserId,
}) => {
  const [hovered, setHovered] = useState(false);
  const translationX = useSharedValue(0);
  const swipeThreshold = 60;
  const maxSwipeOffset = 80;
  const horizontalSwipeRatio = 1.5;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-25, 25]) // Активация только при чётком горизонтальном движении (25px)
    .failOffsetY([-10, 10]) // Быстро отменяется при вертикальном движении (скролл)
    .onUpdate((event) => {
      if (multiSelectActive) return;
      
      // Проверяем, что движение в основном горизонтальное
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      
      // Если вертикальное движение больше горизонтального, не обрабатываем
      if (absY > absX / horizontalSwipeRatio) {
        return;
      }
      
      const clamped = clamp(event.translationX, -maxSwipeOffset, maxSwipeOffset);
      translationX.value = clamped;
    })
    .onEnd((event) => {
      if (multiSelectActive) return;
      
      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      
      // Проверяем, что это действительно горизонтальный свайп
      if (absX > swipeThreshold && absX > absY * horizontalSwipeRatio) {
        const directionOffset = event.translationX > 0 ? 50 : -50;
        translationX.value = withSpring(directionOffset);
        if (typeof onSwipeToReply === "function") {
          // Передаем только ID, так как объект не может быть сериализован в worklet
          runOnJS(onSwipeToReply)(item.id);
        }
      } else {
        // Если не достигнут порог, возвращаем в исходное положение
        translationX.value = withSpring(0);
      }
    })
    .onFinalize(() => {
      translationX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translationX.value }],
  }));

  const getUsername = () => {
    if (item.sender && item.sender.username) {
      return item.sender.username;
    }
    if (item.userId) {
      return `User ${item.userId}`;
    }
    return "Unknown User";
  };

  const resolveUrl = (url) => {
    if (!url) return url;
    const fixed = fixFileUrl(url);
    if (fixed.startsWith("http://") || fixed.startsWith("https://")) return fixed;
    return `${BASE_URL}${fixed}`;
  };

  const renderAttachment = () => {
    if (item.type === "image" && item.fileUrl) {
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onImagePress(item.fileUrl)}
        >
          <Image
            source={{ uri: resolveUrl(item.fileUrl) }}
            style={styles.messageImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      );
    }

    if (item.type === "video" && item.fileUrl) {
      return (
        <Video
          source={{ uri: resolveUrl(item.fileUrl) }}
          style={styles.messageImage}
          useNativeControls
          resizeMode="contain"
        />
      );
    }

    if (item.type === "video_circle" && item.fileUrl) {
      return <VideoCirclePlayer uri={resolveUrl(item.fileUrl)} />;
    }

    if ((item.type === "audio" || item.type === "voice") && item.fileUrl) {
      return (
        <AudioPlayer
          source={{ uri: resolveUrl(item.fileUrl) }}
        />
      );
    }

    if (item.type === "file" && item.fileUrl) {
      return (
        <TouchableOpacity
          onPress={() => {
            Linking.openURL(resolveUrl(item.fileUrl)).catch((err) =>
              console.error("Error opening file:", err)
            );
          }}
        >
          <Text style={styles.messageText}>
            Файл: {item.filename || "Без названия"}
          </Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.swipeableMessage, animatedStyle, isSelected && styles.selectedRow]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => onPressMessage(item)}
          onLongPress={() => onLongPressMessage(item)}
          onStartShouldSetResponder={() => false}
          onMoveShouldSetResponder={() => false}
          onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
          onHoverOut={Platform.OS === 'web' ? () => { setHovered(false); } : undefined}
          style={{ position: 'relative' }}
        >
          {/* Web hover: emoji strip + action bar */}
          {Platform.OS === 'web' && hovered && !multiSelectActive && (
            <View style={[webHoverBar.container, isMyMessage ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
              {/* Emoji strip — shows on hover */}
              <View
                style={[webHoverBar.emojiStrip, isDarkMode && { backgroundColor: '#1a2236', borderColor: 'rgba(255,255,255,0.08)' }]}
                onStartShouldSetResponder={() => true}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {GROUP_EMOJIS.map((emoji) => {
                  const mine = reactions.some((r) => r.emoji === emoji && r.userId === currentUserId);
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[webHoverBar.emojiBtn, mine && webHoverBar.emojiBtnActive]}
                      onPress={() => { onReact(emoji); }}
                      activeOpacity={0.7}
                    >
                      <Text style={webHoverBar.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Action bar */}
              <View style={webHoverBar.actionBar}>
                <TouchableOpacity style={webHoverBar.actionBtn} onPress={() => onPressMessage(item)}>
                  <Icon name="reply" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessage : [styles.otherMessage, isDarkMode && { backgroundColor: '#121826', borderColor: '#1A2233' }],
            ]}
          >
            {item.replyToId && repliedMessage && (
              <View style={styles.replyPreview}>
                <Text
                  style={[
                    styles.replyUsername,
                    isMyMessage && styles.replyUsernameMine,
                  ]}
                >
                  {repliedMessage.sender?.username ||
                    `User ${repliedMessage.userId}`}
                </Text>
                {repliedMessage.text ? (
                  <Text
                    style={[
                      styles.replyText,
                      isMyMessage && styles.replyTextMine,
                    ]}
                    numberOfLines={1}
                  >
                    {repliedMessage.text}
                  </Text>
                ) : repliedMessage.type === "image" ? (
                  <Text style={styles.replyText}>[Фото]</Text>
                ) : repliedMessage.type === "video" ? (
                  <Text style={styles.replyText}>[Видео]</Text>
                ) : repliedMessage.type === "audio" ? (
                  <Text style={styles.replyText}>[Аудио]</Text>
                ) : (
                  <Text style={styles.replyText}>[Файл]</Text>
                )}
              </View>
            )}

            <Text
              style={[
                styles.messageUser,
                isMyMessage && styles.myMessageUser,
                !isMyMessage && isDarkMode && { color: '#a0a0b0' },
              ]}
            >
              {getUsername()}
            </Text>

            {item.forwardedFromUsername ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 }}>
                <Icon2 name="share" size={12} color={isMyMessage ? 'rgba(255,255,255,0.8)' : '#7C5CFF'} />
                <Text style={{ fontSize: 12, fontStyle: 'italic', color: isMyMessage ? 'rgba(255,255,255,0.8)' : '#7C5CFF' }}>
                  Переслано от {item.forwardedFromUsername}
                </Text>
              </View>
            ) : null}

            {item.type === "text" && item.text ? (
              <Text
                style={[
                  styles.messageText,
                  isMyMessage && styles.myMessageText,
                  !isMyMessage && isDarkMode && { color: '#e0e0e0' },
                ]}
              >
                {item.text}
              </Text>
            ) : null}

            {renderAttachment()}

            {/* Poll */}
            {item.type === 'poll' && pollData && (
              <PollMessage poll={pollData} />
            )}
            {item.type === 'poll' && !pollData && (
              <Text style={{ color: isDarkMode ? '#aaa' : '#666', fontStyle: 'italic', marginTop: 4 }}>Загрузка опроса...</Text>
            )}

            {/* Translation */}
            {translation?.text && (
              <View style={{
                marginTop: 6, padding: 8, borderRadius: 8,
                backgroundColor: isMyMessage ? 'rgba(255,255,255,0.12)' : (isDarkMode ? 'rgba(124, 92, 255, 0.1)' : 'rgba(124, 92, 255, 0.06)'),
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: isMyMessage ? 'rgba(255,255,255,0.6)' : '#7C5CFF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Перевод</Text>
                <Text style={{ fontSize: 14, color: isMyMessage ? '#fff' : (isDarkMode ? '#F5F7FA' : '#333') }}>{translation.text}</Text>
              </View>
            )}
            {translation?.error && (
              <Text style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>{translation.error}</Text>
            )}

            <View style={styles.messageFooter}>
              {/* Translate button */}
              {onTranslate && item.text && !multiSelectActive && (
                <TouchableOpacity
                  onPress={() => onTranslate(item.id, item.text)}
                  style={{ padding: 2, marginRight: 4 }}
                  activeOpacity={0.7}
                >
                  <Icon2 name="translate" size={13} color={isMyMessage ? 'rgba(255,255,255,0.5)' : (isDarkMode ? 'rgba(255,255,255,0.3)' : '#aaa')} />
                </TouchableOpacity>
              )}
              {item.isEdited && (
                <Text style={{
                  fontSize: 10,
                  color: isMyMessage ? 'rgba(255,255,255,0.5)' : (isDarkMode ? '#888' : '#aaa'),
                  marginRight: 3,
                  fontStyle: 'italic',
                }}>изменено</Text>
              )}
              <Text
                style={[
                  styles.timestamp,
                  isMyMessage && styles.myTimestamp,
                  !isMyMessage && isDarkMode && { color: '#888' },
                ]}
              >
                {new Date(item.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {isMyMessage && (
                <View style={styles.checkmarkContainer}>
                  <Icon
                    name="check"
                    size={12}
                    color={isRead ? "#C5CAFF" : "rgba(255,255,255,0.7)"}
                  />
                  {isRead && (
                    <Icon
                      name="check"
                      size={12}
                      color="#C5CAFF"
                      style={styles.doubleCheck}
                    />
                  )}
                </View>
              )}
              {item.repliesCount > 0 && (
                <TouchableOpacity
                  onPress={() => onRepliesPress(item.id)}
                  style={[
                    styles.repliesBadge,
                    isMyMessage && styles.repliesBadgeMy,
                  ]}
                >
                  <Text
                    style={[
                      styles.repliesText,
                      isMyMessage && styles.repliesTextMy,
                    ]}
                  >
                    {item.repliesCount}{" "}
                    {item.repliesCount === 1 ? "ответ" : "ответа"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

          </View>

          {/* Reaction bubbles — outside bubble */}
          {reactions.length > 0 && (
            <View style={[reactionRowStyle.row, isMyMessage && reactionRowStyle.rowMy]}>
              {Object.entries(
                reactions.reduce((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => {
                const mine = reactions.some((r) => r.emoji === emoji && r.userId === currentUserId);
                return (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => onReact(emoji)}
                    style={[
                      reactionRowStyle.bubble,
                      mine && reactionRowStyle.bubbleMine,
                      isDarkMode && !mine && { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.06)' },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={reactionRowStyle.emoji}>{emoji}</Text>
                    {count > 1 && <Text style={[reactionRowStyle.count, mine && { color: '#7C5CFF' }]}>{count}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}


        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};

const actionReactStyles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  emojiBtn: {
    padding: 6,
    borderRadius: 20,
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(124,92,255,0.15)',
  },
  emojiText: { fontSize: 24 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: 4,
  },
});

const webHoverBar = StyleSheet.create({
  container: {
    flexDirection: 'column',
    marginBottom: 2,
    zIndex: 10,
  },
  emojiStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 2,
  },
  emojiBtn: {
    padding: 4,
    borderRadius: 16,
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(124,92,255,0.15)',
  },
  emojiText: { fontSize: 22 },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30,30,45,0.88)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionBtn: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerWrap: {
    marginTop: 4,
    zIndex: 100,
  },
});

const reactionRowStyle = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, alignSelf: 'flex-start' },
  rowMy: { alignSelf: 'flex-end' },
  bubble: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0eeff', borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 3,
    marginRight: 4, marginBottom: 2,
    borderWidth: 1, borderColor: 'rgba(124,92,255,0.15)',
  },
  bubbleMine: { backgroundColor: '#e5dfff', borderColor: '#7C5CFF' },
  emoji: { fontSize: 14 },
  count: { fontSize: 11, marginLeft: 3, color: '#555' },
  smiley: {
    alignSelf: 'flex-start', marginTop: 3,
    opacity: 0.5,
  },
  smileyMy: { alignSelf: 'flex-end' },
});

const styles = StyleSheet.create({
  swipeableMessage: {
    width: "100%",
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    overflow: 'hidden',
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#7C5CFF",
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  headerMiddle: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backButton: {
    padding: 10,
  },
  iconButton: {
    padding: 10,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  groupInfo: {
    fontSize: 12,
    color: "#E0E0E0",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 18,
    color: "#666",
  },
  messagesList: {
    flex: 1,
    minHeight: 0,
  },
  messagesContentContainer: {
    padding: 12,
    paddingBottom: 24,
  },
  dateSeparator: {
    alignItems: "center",
    marginVertical: 8,
  },
  dateChip: {
    paddingHorizontal: 16,
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
    maxWidth: SCREEN_WIDTH * 0.8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    marginVertical: 6,
    shadowColor: "#22233B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  myMessage: {
    backgroundColor: "#7C5CFF",
    alignSelf: "flex-end",
    borderBottomRightRadius: 8,
  },
  otherMessage: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECECF5",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 8,
  },
  selectedMessage: {
    borderWidth: 1,
    borderColor: "#B39DDB",
  },
  selectedRow: {
    backgroundColor: 'rgba(124, 92, 255, 0.08)',
    borderRadius: 16,
  },
  messageUser: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#5E5D7C",
    marginBottom: 5,
  },
  myMessageUser: {
    color: "#E0E0FF",
  },
  messageText: {
    fontSize: 16,
    color: "#2C2B3E",
    lineHeight: 22,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  messageImage: {
    width: SCREEN_WIDTH * 0.6,
    maxWidth: 300,
    maxHeight: 300,
    aspectRatio: 1,
    borderRadius: 10,
    marginTop: 5,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  timestamp: {
    fontSize: 12,
    color: "#7C7B92",
    marginRight: 4,
  },
  myTimestamp: {
    color: "rgba(255,255,255,0.8)",
  },
  checkmarkContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  doubleCheck: {
    marginLeft: -6,
  },
  repliesBadge: {
    backgroundColor: "rgba(108, 99, 255, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 6,
  },
  repliesText: {
    fontSize: 12,
    color: "#7C5CFF",
  },
  repliesBadgeMy: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  repliesTextMy: {
    color: "#FFFFFF",
  },
  inputContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  innerContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  inputAndMicrophone: {
    flexDirection: "row",
    backgroundColor: theme.colors.inputBackground || "#F5F5F5",
    flex: 1,
    borderRadius: 24,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  attachBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  attachSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  attachHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148,163,184,0.4)",
    alignSelf: "center",
    marginBottom: 18,
  },
  attachGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    rowGap: 18,
  },
  attachItem: {
    alignItems: "center",
    width: 76,
  },
  attachIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 8,
  },
  attachLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlignVertical: "top",
    includeFontPadding: false,
    color: theme.colors.inputText || "#000",
    minHeight: 32,
    maxHeight: 104,
  },
  emoticonButton: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 5,
  },
  rightIconButtonStyle: {
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 5,
  },
  sendButton: {
    backgroundColor: theme.colors.primary || "#7C5CFF",
    borderRadius: 24,
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  replyPreview: {
    backgroundColor: "rgba(108, 99, 255, 0.08)",
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  replyUsername: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#5E5D7C",
  },
  replyUsernameMine: {
    color: "#E0E0FF",
  },
  replyText: {
    fontSize: 12,
    color: "#6F6F8B",
  },
  replyTextMine: {
    color: "rgba(255,255,255,0.85)",
  },
  replyPreviewContainer: {
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
  replyBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#00C2FF',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  replyPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  replyPreviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewUsername: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00C2FF",
    flex: 1,
  },
  replyPreviewText: {
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
  audioPlayer: {
    borderRadius: 20,
    padding: 10,
    marginTop: 5,
    alignItems: "center",
  },
  audioText: {
    color: "#333",
    fontSize: 14,
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
});

export default GroupChatScreen;