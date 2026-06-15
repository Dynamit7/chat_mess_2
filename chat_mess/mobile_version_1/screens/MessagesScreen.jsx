import { useEffect, useState, useMemo, useRef } from "react";
import { View, Platform, BackHandler, KeyboardAvoidingView, Keyboard, Dimensions, TextInput, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChatHeader from "../components/messages/ChatHeader";
import ChatInput from "../components/messages/ChatInput";
import MessagesList from "../components/messages/MessagesList";
import { useTheme } from "../ThemeContext";
import { theme } from "../theme";
import socket from "../src/socket";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../src/config";
import ForwardSheet from "../components/ForwardSheet";
import useTranslateMessage from "../helpers/useTranslateMessage";
import VideoCircleRecorder from "../components/messages/VideoCircleRecorder";
import * as FileSystem from 'expo-file-system';

const MessagesScreen = ({ route }) => {
  const { username, bio, picture, id } = route.params;
  const partnerId = Number(id) || null;

  const [currentUserId, setCurrentUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState(null);
  const [isLeft, setIsLeft] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [isMultiSelect, setMultiSelect] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [forwardSheetVisible, setForwardSheetVisible] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isEmojiVisible, setEmojiVisible] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState("Offline"); // Состояние для Online/Offline статуса
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showVideoCircleRecorder, setShowVideoCircleRecorder] = useState(false);

  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { translations, translateMessage } = useTranslateMessage();

  const displayedMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => m.text && m.text.toLowerCase().includes(q));
  }, [messages, searchQuery]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Отслеживаем высоту клавиатуры для динамического отступа
  useEffect(() => {
    if (Platform.OS === "android") {
      const keyboardWillShow = Keyboard.addListener("keyboardDidShow", (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      const keyboardWillHide = Keyboard.addListener("keyboardDidHide", () => {
        setKeyboardHeight(0);
      });

      return () => {
        keyboardWillShow.remove();
        keyboardWillHide.remove();
      };
    }
  }, []);

  // Обработка кнопки "Назад" на Android
  useEffect(() => {
    if (Platform.OS === "android") {
      const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
        // Если открыта клавиатура или есть активные модальные окна, закрываем их
        if (reply || editingMessage || isMultiSelect) {
          if (reply) setReply(null);
          if (editingMessage) setEditingMessage(null);
          if (isMultiSelect) {
            setMultiSelect(false);
            setSelectedMessages([]);
          }
          return true; // Предотвращаем выход из экрана
        }
        return false; // Разрешаем стандартное поведение (выход из экрана)
      });

      return () => backHandler.remove();
    }
  }, [reply, editingMessage, isMultiSelect]);

  useEffect(() => {
    const loadGhostMode = async () => {
      try {
        const storedGhostMode = await AsyncStorage.getItem("ghostMode");
        if (storedGhostMode) {
          setGhostMode(JSON.parse(storedGhostMode));
        }
      } catch (err) {
        console.log("Error loading ghostMode:", err);
      }
    };
    loadGhostMode();
  }, []);

  useEffect(() => {
    const fetchUserId = async () => {
      const stored = await AsyncStorage.getItem("userId");
      if (stored) {
        setCurrentUserId(Number(stored));
      }
    };
    fetchUserId();
  }, []);

  const roomName = currentUserId && partnerId
    ? `chat_${Math.min(currentUserId, partnerId)}_${Math.max(currentUserId, partnerId)}`
    : "";

  // Обработчик события "печатает"
  useEffect(() => {
    if (!partnerId || !roomName) return;
    
    const handleUserTyping = (data) => {
      console.log('Received typing event:', { data, partnerId, currentUserId, roomName });
      
      // Проверяем, что событие относится к нашему партнеру
      if (Number(data.userId) === Number(partnerId)) {
        if (data.isTyping) {
          // Добавляем пользователя в список печатающих
          setTypingUsers(prev => {
            if (!prev.includes(data.userId)) {
              console.log('Adding user to typing list:', data.userId);
              return [...prev, data.userId];
            }
            return prev;
          });
        } else {
          // Убираем пользователя из списка печатающих
          setTypingUsers(prev => {
            const filtered = prev.filter(id => id !== data.userId);
            console.log('Removing user from typing list:', data.userId, 'remaining:', filtered);
            return filtered;
          });
        }
      }
    };

    // Слушаем события через Redis
    socket.on("userTyping", handleUserTyping);
    
    return () => {
      socket.off("userTyping", handleUserTyping);
      // При размонтировании сбрасываем статус печатания
      setTypingUsers([]);
    };
  }, [partnerId, currentUserId, roomName]);

  // Обработчик Online/Offline статуса
  useEffect(() => {
    if (!partnerId) return;

    // Получаем начальный статус
    const fetchOnlineStatus = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/messages/user/${partnerId}/online`);
        if (response.ok) {
          const data = await response.json();
          setOnlineStatus(data.isOnline ? "Online" : "Offline");
        } else {
          setOnlineStatus("Offline");
        }
      } catch (error) {
        console.error("Error fetching online status:", error);
        setOnlineStatus("Offline");
      }
    };

    fetchOnlineStatus();

    // Слушаем события изменения статуса
    const handleUserOnline = ({ userId }) => {
      if (Number(userId) === Number(partnerId)) {
        setOnlineStatus("Online");
      }
    };

    const handleUserOffline = ({ userId }) => {
      if (Number(userId) === Number(partnerId)) {
        setOnlineStatus("Offline");
      }
    };

    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);

    return () => {
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
    };
  }, [partnerId]);

  useEffect(() => {
    if (!roomName || !currentUserId || !partnerId) return;

    // Присоединяемся к комнатам
    socket.emit("joinRoom", roomName);
    socket.emit("joinRoom", `user_${currentUserId}`);
    console.log(`Joined rooms: ${roomName}, user_${currentUserId}`);

    // Re-join rooms after socket reconnect (socket loses room membership on disconnect)
    const handleReconnect = async () => {
      socket.emit("registerUser", { userId: currentUserId });
      socket.emit("joinRoom", roomName);
      socket.emit("joinRoom", `user_${currentUserId}`);
      console.log(`Re-joined rooms after reconnect: ${roomName}, user_${currentUserId}`);
      // Re-fetch messages in case we missed any while disconnected
      try {
        const res = await fetch(
          `${BASE_URL}/api/messages/getMessages?user1=${currentUserId}&user2=${partnerId}`
        );
        if (res.ok) {
          const fetched = await res.json();
          if (Array.isArray(fetched)) {
            setMessages(fetched.map((msg) => ({ ...msg, reactions: msg.reactions || [] })));
          }
        }
      } catch (_) {}
    };
    socket.on("connect", handleReconnect);

    const handleMessageReceived = (newMessage) => {
      console.log("Received message event", newMessage);
      
      // Проверяем, что сообщение относится к текущему чату
      const isFromPartnerToMe =
        Number(newMessage.fromUserId) === Number(partnerId) &&
        Number(newMessage.toUserId) === Number(currentUserId);
      const isFromMeToPartner =
        Number(newMessage.fromUserId) === Number(currentUserId) &&
        Number(newMessage.toUserId) === Number(partnerId);

      if (!isFromPartnerToMe && !isFromMeToPartner) {
        console.log("Message not for this chat, ignoring");
        return;
      }

      const resolvedIsRead = ghostMode && Number(newMessage.fromUserId) === Number(partnerId)
        ? false
        : newMessage.isRead;

      const messageWithText = {
        ...newMessage,
        isRead: resolvedIsRead,
        reactions: newMessage.reactions || [],
      };

      setMessages((prev) => {
        // Проверяем, не существует ли уже сообщение с таким id
        if (prev.some((msg) => Number(msg.id) === Number(newMessage.id))) {
          console.log(`Message with id ${newMessage.id} already exists, skipping`);
          return prev;
        }

        // Если это наше сообщение с tempId, заменяем временное сообщение
        if (Number(newMessage.fromUserId) === Number(currentUserId) && newMessage.tempId) {
          const tempIndex = prev.findIndex((msg) => msg.tempId === newMessage.tempId);
          if (tempIndex !== -1) {
            const tempMsg = prev[tempIndex];
            // Сохраняем isRead: true если temp уже был помечен прочитанным
            // (race condition: messagesReadByRecipient пришёл ДО messageReceived)
            const finalIsRead = tempMsg.isRead || messageWithText.isRead;
            const updatedMessages = [...prev];
            updatedMessages[tempIndex] = { ...messageWithText, isRead: finalIsRead };
            return updatedMessages;
          }
        }

        console.log(`Appending new message with id ${newMessage.id}`);
        return [...prev, messageWithText];
      });

      if (Number(newMessage.fromUserId) === Number(partnerId) && !ghostMode) {
        markAsRead();
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      console.log(`Received messageDeleted event for message ${messageId}`);
      // Удаляем сообщение из локального состояния, если оно еще там есть
      setMessages((prev) => {
        const filtered = prev.filter((msg) => String(msg.id) !== String(messageId) && Number(msg.id) !== Number(messageId));
        return filtered;
      });
      setSelectedMessages((prev) => prev.filter((id) => String(id) !== String(messageId) && Number(id) !== Number(messageId)));
    };

    const handleMessageEdited = ({ messageId, newText, isEdited }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, text: newText, isEdited: true } : msg))
      );
    };

    const handleMessagesRead = ({ readerId, partnerId: evtPartnerId, unreadCount }) => {
      if (Number(evtPartnerId) === Number(currentUserId) && Number(readerId) === Number(id) && !ghostMode) {
        setMessages((prev) =>
          prev.map((m) => {
            if (Number(m.fromUserId) === Number(currentUserId) && !m.isRead) {
              return { ...m, isRead: true };
            }
            return m;
          })
        );
      }
    };

    // Устанавливаем обработчики событий
    socket.on("messageReceived", handleMessageReceived);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("messageEdited", handleMessageEdited);
    socket.on("messagesReadByRecipient", handleMessagesRead);

    return () => {
      // Отписываемся от событий при размонтировании
      socket.off("connect", handleReconnect);
      socket.off("messageReceived", handleMessageReceived);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("messageEdited", handleMessageEdited);
      socket.off("messagesReadByRecipient", handleMessagesRead);
    };
  }, [roomName, currentUserId, partnerId, id, ghostMode]);

  useEffect(() => {
    if (currentUserId && partnerId) {
      const fetchMessages = async () => {
        try {
          const res = await fetch(
            `${BASE_URL}/api/messages/getMessages?user1=${currentUserId}&user2=${partnerId}`
          );
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error("Server error response:", errorData);
            return; // Не очищаем сообщения при ошибке сервера
          }
          const fetched = await res.json();

          if (!Array.isArray(fetched)) {
            console.error("Expected an array, got:", fetched);
            return; // Не очищаем сообщения при неожиданном ответе
          }

          const formattedMessages = fetched.map((msg) => ({
            ...msg,
            isRead: ghostMode && msg.fromUserId === partnerId ? false : msg.isRead,
            reactions: msg.reactions || [],
          }));

          setMessages(formattedMessages);

          if (!ghostMode) {
            const response = await fetch(`${BASE_URL}/api/messages/markAsRead`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentUserId, partnerId }),
            });
            const readData = await response.json();
            if (readData.success) {
              socket.emit("messagesRead", { readerId: currentUserId, partnerId, unreadCount: 0 });
            }
          }
        } catch (err) {
          console.error("Error fetching messages:", err);
          // Не очищаем сообщения при сетевой ошибке
        }
      };
      fetchMessages();
    }
  }, [currentUserId, partnerId, ghostMode]);

  const markAsRead = async () => {
    if (!currentUserId || !partnerId) return;
    try {
      // МГНОВЕННО: эмитим сокет ДО HTTP-запроса — отправитель получит ✓✓ сразу
      socket.emit("messagesRead", { readerId: currentUserId, partnerId, unreadCount: 0 });

      // Обновляем локальный state читателя
      setMessages((prev) =>
        prev.map((msg) =>
          Number(msg.fromUserId) === Number(partnerId) && !msg.isRead
            ? { ...msg, isRead: true }
            : msg
        )
      );

      // Обновляем БД в фоне (не ждём — не блокируем UI)
      fetch(`${BASE_URL}/api/messages/markAsRead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentUserId, partnerId }),
      }).catch((err) => console.error("markAsRead HTTP error:", err));
    } catch (err) {
      console.error("Error marking messages as read:", err);
    }
  };

  const handleSendMessage = async (msg) => {
    if (!currentUserId || !partnerId) return;

    if (msg.type === "edit") {
      handleEditMessage(msg.messageId, msg.text);
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const newMessage = {
      id: tempId,
      tempId,
      fromUserId: currentUserId,
      toUserId: partnerId,
      text: msg.text || "",
      type: msg.type || "text",
      fileUrl: msg.fileUrl || null,
      filename: msg.filename || null,
      latitude: msg.latitude ?? null,
      longitude: msg.longitude ?? null,
      isRead: false,
      createdAt: new Date().toISOString(),
      replyToId: reply ? reply.id : null,
      replyTo: reply
        ? {
            id: reply.id,
            text: reply.text,
            fromUserId: isLeft ? partnerId : currentUserId,
          }
        : null,
      reactions: [],
    };

    setMessages((prev) => [...prev, newMessage]);

    try {
      const response = await fetch(`${BASE_URL}/api/messages/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUserId: currentUserId,
          toUserId: partnerId,
          text: msg.text || "",
          type: msg.type || "text",
          fileUrl: msg.fileUrl || null,
          filename: msg.filename || null,
          latitude: msg.latitude ?? null,
          longitude: msg.longitude ?? null,
          replyToId: reply ? reply.id : null,
          tempId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        const savedMessage = data.message;
        setMessages((prev) => {
          const tempIndex = prev.findIndex((m) => m.tempId === tempId);
          if (tempIndex !== -1) {
            const updatedMessages = [...prev];
            // Сохраняем isRead: true если партнёр уже прочитал сообщение
            // пока шёл HTTP запрос (savedMessage.isRead всегда false из БД)
            const preservedIsRead = prev[tempIndex].isRead || savedMessage.isRead;
            updatedMessages[tempIndex] = {
              ...savedMessage,
              isRead: preservedIsRead,
              reactions: savedMessage.reactions || [],
            };
            return updatedMessages;
          }
          return prev;
        });
      } else {
        console.error("Failed to send message:", data.error);
        setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    }

    setReply(null);
  };

  const handleVideoCircleRecorded = async (videoUri) => {
    try {
      console.log('Uploading video circle from:', videoUri);
      const uploadResult = await FileSystem.uploadAsync(
        `${BASE_URL}/upload`,
        videoUri,
        {
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'video/mp4',
          parameters: {},
        }
      );
      console.log('Upload result status:', uploadResult.status);
      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const uploadData = JSON.parse(uploadResult.body);
        if (uploadData.url) {
          handleSendMessage({
            type: 'video_circle',
            fileUrl: uploadData.url,
            text: '',
          });
        }
      } else {
        console.error('Upload failed:', uploadResult.status, uploadResult.body);
      }
    } catch (err) {
      console.error('Error uploading video circle:', err);
    } finally {
      setShowVideoCircleRecorder(false);
    }
  };

  const swipeToReply = (message, isLeft) => {
    const text = message.text
      ? message.text
      : message.filename
      ? message.filename
      : "";
    setReply({
      id: message.id,
      text: text.length > 50 ? text.slice(0, 50) + "..." : text,
      username: isLeft ? username : "Вы",
    });
    setIsLeft(isLeft);
  };

  const handleReply = (message, isLeft) => {
    swipeToReply(message, isLeft);
  };

  const closeReply = () => setReply(null);

 const handleDeleteMessages = async (messageIds) => {
  const deletedIds = [];
  
  for (const messageId of messageIds) {
    if (String(messageId).startsWith("temp-")) {
      console.log(`Cannot delete temporary message with id ${messageId}. Waiting for server confirmation.`);
      // Удаляем временные сообщения сразу из локального состояния
      setMessages((prev) => prev.filter((msg) => String(msg.id) !== String(messageId)));
      setSelectedMessages((prev) => prev.filter((id) => String(id) !== String(messageId)));
      continue;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/messages/deleteMessage?messageId=${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errData = await res.json();
        console.error(`Delete failed for message ${messageId}: ${JSON.stringify(errData)}`);
        continue;
      }

      const data = await res.json();
      if (data.success) {
        console.log(`Delete successful for message ${messageId}`);
        deletedIds.push(messageId);
        // Отправляем событие через socket для синхронизации
        socket.emit("deleteMessage", { roomName, messageId });
      } else {
        console.log(`Delete error for message ${messageId}: ${data.error}`);
      }
    } catch (err) {
      console.error(`Error deleting message ${messageId}:`, err);
    }
  }
  
  // Удаляем сообщения из локального состояния только после успешного удаления на сервере
  if (deletedIds.length > 0) {
    setMessages((prev) => prev.filter((msg) => !deletedIds.includes(String(msg.id)) && !deletedIds.includes(Number(msg.id))));
    setSelectedMessages((prev) => prev.filter((id) => !deletedIds.includes(String(id)) && !deletedIds.includes(Number(id))));
    
    // ВАЖНО: После удаления сообщений обновляем счетчик непрочитанных
    // Это временное решение до получения события от сервера
    setTimeout(() => {
      socket.emit("chatUpdated", { 
        partnerId: partnerId, 
        unreadCount: 0 
      });
    }, 100);
  }
};

  const handleForwardMessages = () => {
    if (selectedMessages.length === 0) return;
    const msg = messages.find((m) => String(m.id) === String(selectedMessages[0]));
    if (!msg) return;
    setMessageToForward({
      id: msg.id,
      sourceType: 'direct',
      text: msg.text || '',
      type: msg.type || 'text',
      fileUrl: msg.fileUrl || null,
      filename: msg.filename || null,
      senderUsername: username || '',
    });
    setForwardSheetVisible(true);
    setMultiSelect(false);
    setSelectedMessages([]);
  };

  const startEditingMessage = (messageId, text) => {
    const messageToEdit = messages.find((m) => m.id === messageId);
    if (messageToEdit) {
      setEditingMessage({ ...messageToEdit, text });
    }
  };

  const handleEditMessage = async (messageId, newText) => {
    fetch(`${BASE_URL}/api/messages/editMessage`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messageId, newText }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((errData) => {
            console.log("Edit error response:", errData);
          });
        }
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, text: newText, isEdited: true } : msg))
        );
        socket.emit("editMessage", { roomName, messageId, newText });
        socket.emit("updateLastMessage", { roomName, messageId, newText });
        setEditingMessage(null);
      })
      .catch((err) => console.log("Error editing message:", err));
  };

  const handleHighlightMessage = (messageId) => {
    setHighlightedMessageId(messageId);
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1000);
  };

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        minHeight: 0,
        ...(Platform.OS === 'web'
          ? { height: Dimensions.get('window').height, maxHeight: Dimensions.get('window').height }
          : null),
        backgroundColor: isDarkMode ? "#0B0F19" : "#FAFBFE",
        overflow: 'hidden',
      }}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.select({ 
        ios: 64 + (insets.top || 0), 
        android: -(insets.bottom || 0) // Компенсируем безопасную зону снизу
      })}
      enabled={true}
    >
      <ChatHeader
        username={username}
        picture={picture}
        onlineStatus={onlineStatus}
        currentUserId={currentUserId}
        partnerId={partnerId}
        selectedMessages={selectedMessages}
        setSelectedMessages={setSelectedMessages}
        setMultiSelect={setMultiSelect}
        onDeleteMessages={handleDeleteMessages}
        onEditMessage={startEditingMessage}
        onForwardMessages={handleForwardMessages}
        messages={messages}
        typingUsers={typingUsers}
        onSearchPress={() => {
          setIsSearchOpen((prev) => {
            if (prev) setSearchQuery("");
            return !prev;
          });
        }}
      />
      {isSearchOpen && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#0B0F19' : '#f0f0f7',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: isDarkMode ? '#1A2233' : '#e0e0e0',
        }}>
          <Ionicons name="search-outline" size={18} color={isDarkMode ? '#aaa' : '#666'} style={{ marginRight: 8 }} />
          <TextInput
            autoFocus
            style={{
              flex: 1,
              fontSize: 15,
              color: isDarkMode ? '#fff' : '#222',
              paddingVertical: 4,
            }}
            placeholder="Поиск по сообщениям..."
            placeholderTextColor={isDarkMode ? '#666' : '#aaa'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={isDarkMode ? '#aaa' : '#666'} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={[{ flex: 1, minHeight: 0 }, isEmojiVisible && { maxHeight: Math.max(Dimensions.get('window').height - 280 - 180 - (insets.bottom || 0), 100) }]}>
        <MessagesList
          onSwipeToReply={swipeToReply}
          messages={displayedMessages}
          currentUserId={currentUserId}
          onDeleteMessage={handleDeleteMessages}
          onEditMessage={startEditingMessage}
          onReplyMessage={handleReply}
          highlightedMessageId={highlightedMessageId}
          onHighlightMessage={handleHighlightMessage}
          isMultiSelect={isMultiSelect}
          setMultiSelect={setMultiSelect}
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
          translations={translations}
          onTranslate={translateMessage}
        />
      </View>
      <ChatInput
        reply={reply}
        isLeft={isLeft}
        closeReply={closeReply}
        username={username}
        onSend={handleSendMessage}
        editingMessage={editingMessage}
        currentUserId={currentUserId}
        partnerId={partnerId}
        onEmojiVisibilityChange={setEmojiVisible}
        onVideoCirclePress={() => setShowVideoCircleRecorder(true)}
      />
      <ForwardSheet
        visible={forwardSheetVisible && !!messageToForward}
        onClose={() => {
          setForwardSheetVisible(false);
          setMessageToForward(null);
        }}
        messageToForward={messageToForward}
        currentUserId={currentUserId}
        isDarkMode={isDarkMode}
      />
      <VideoCircleRecorder
        visible={showVideoCircleRecorder}
        onClose={() => setShowVideoCircleRecorder(false)}
        onVideoRecorded={handleVideoCircleRecorded}
      />
    </KeyboardAvoidingView>
  );
};

export default MessagesScreen;


// import { useEffect, useState } from "react";
// import { View, Platform } from "react-native";
// import ChatHeader from "../components/messages/ChatHeader";
// import ChatInput from "../components/messages/ChatInput";
// import MessagesList from "../components/messages/MessagesList";
// import { useTheme } from "../ThemeContext";
// import { theme } from "../theme";
// import socket from "../src/socket";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import { BASE_URL } from "../src/config";

// // const BASE_URL = Platform.select({ web: "http://192.168.77.41:3000", default: "http://192.168.77.41:3000" });

// const MessagesScreen = ({ route }) => {
//   const { username, bio, picture, id } = route.params;
//   const partnerId = Number(id) || null;

//   const [currentUserId, setCurrentUserId] = useState(null);
//   const [messages, setMessages] = useState([]);
//   const [reply, setReply] = useState(null);
//   const [isLeft, setIsLeft] = useState(false);
//   const [editingMessage, setEditingMessage] = useState(null);
//   const [ghostMode, setGhostMode] = useState(false);
//   const [highlightedMessageId, setHighlightedMessageId] = useState(null);
//   const [isMultiSelect, setMultiSelect] = useState(false);
//   const [selectedMessages, setSelectedMessages] = useState([]);

//   const { isDarkMode } = useTheme();

//   useEffect(() => {
//     const loadGhostMode = async () => {
//       try {
//         const storedGhostMode = await AsyncStorage.getItem("ghostMode");
//         if (storedGhostMode) {
//           setGhostMode(JSON.parse(storedGhostMode));
//         }
//       } catch (err) {
//         console.log("Error loading ghostMode:", err);
//       }
//     };
//     loadGhostMode();
//   }, []);

//   useEffect(() => {
//     const fetchUserId = async () => {
//       const stored = await AsyncStorage.getItem("userId");
//       if (stored) {
//         setCurrentUserId(Number(stored));
//       }
//     };
//     fetchUserId();
//   }, []);

//   const roomName = currentUserId && partnerId
//     ? `chat_${Math.min(currentUserId, partnerId)}_${Math.max(currentUserId, partnerId)}`
//     : "";

//   useEffect(() => {
//     if (roomName && currentUserId) {
//       socket.emit("joinRoom", roomName);
//       socket.emit("joinRoom", `user_${currentUserId}`);
//       console.log(`Joined rooms: ${roomName}, user_${currentUserId}`);
//     }

//     const handleMessageReceived = (newMessage) => {
//       console.log("Received message event", newMessage);

//       const messageWithText = {
//         ...newMessage,
//         isRead: ghostMode && newMessage.fromUserId === partnerId ? false : newMessage.isRead,
//         reactions: newMessage.reactions || [],
//       };

//       setMessages((prev) => {
//         if (prev.some((msg) => msg.id === newMessage.id)) {
//           console.log(`Message with id ${newMessage.id} already exists, skipping`);
//           return prev;
//         }

//         if (newMessage.fromUserId === currentUserId && newMessage.tempId) {
//           const tempIndex = prev.findIndex((msg) => msg.tempId === newMessage.tempId);
//           if (tempIndex !== -1) {
//             console.log(`Replacing temp message with tempId ${newMessage.tempId} at index ${tempIndex}`);
//             const updatedMessages = [...prev];
//             updatedMessages[tempIndex] = messageWithText;
//             return updatedMessages;
//           }
//           console.log(`No temp message found for tempId ${newMessage.tempId}, skipping append`);
//           return prev;
//         }

//         console.log(`Appending new message with id ${newMessage.id}`);
//         return [...prev, messageWithText];
//       });

//       if (newMessage.fromUserId === partnerId && !ghostMode) {
//         markAsRead();
//       }
//     };

//     const handleMessageDeleted = ({ messageId }) => {
//       console.log(`Deleting message with id ${messageId}`);
//       setMessages((prev) => prev.filter((msg) => String(msg.id) !== String(messageId)));
//       setSelectedMessages((prev) => prev.filter((id) => String(id) !== String(messageId)));
//     };

//     const handleMessageEdited = ({ messageId, newText }) => {
//       console.log(`Editing message with id ${messageId} to text: ${newText}`);
//       setMessages((prev) =>
//         prev.map((msg) => (msg.id === messageId ? { ...msg, text: newText } : msg))
//       );
//     };

//     const handleMessagesRead = ({ readerId, partnerId, unreadCount }) => {
//       console.log(`Messages read by ${readerId} for partner ${partnerId}, unreadCount: ${unreadCount}`);
//       if (partnerId === currentUserId && readerId === id && !ghostMode) {
//         setMessages((prev) =>
//           prev.map((m) => {
//             if (m.fromUserId === currentUserId && !m.isRead) {
//               return { ...m, isRead: true };
//             }
//             return m;
//           })
//         );
//       }
//     };

//     socket.on("messageReceived", handleMessageReceived);
//     socket.on("messageDeleted", handleMessageDeleted);
//     socket.on("messageEdited", handleMessageEdited);
//     socket.on("messagesReadByRecipient", handleMessagesRead);

//     return () => {
//       socket.off("messageReceived", handleMessageReceived);
//       socket.off("messageDeleted", handleMessageDeleted);
//       socket.off("messageEdited", handleMessageEdited);
//       socket.off("messagesReadByRecipient", handleMessagesRead);
//     };
//   }, [roomName, currentUserId, partnerId, id, ghostMode]);

//   useEffect(() => {
//     if (currentUserId && partnerId) {
//       const fetchMessages = async () => {
//         try {
//           const res = await fetch(
//             `${BASE_URL}/api/messages/getMessages?user1=${currentUserId}&user2=${partnerId}`
//           );
//           if (!res.ok) {
//             const errorData = await res.json();
//             console.error("Server error response:", errorData);
//             throw new Error(`HTTP error! status: ${res.status}`);
//           }
//           const messages = await res.json();

//           if (!Array.isArray(messages)) {
//             console.error("Expected an array, got:", messages);
//             setMessages([]);
//             return;
//           }

//           const formattedMessages = messages.map((msg) => ({
//             ...msg,
//             isRead: ghostMode && msg.fromUserId === partnerId ? false : msg.isRead,
//             reactions: msg.reactions || [],
//           }));

//           setMessages(formattedMessages);

//           if (!ghostMode) {
//             const response = await fetch(`${BASE_URL}/api/messages/markAsRead`, {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({ currentUserId, partnerId }),
//             });
//             const data = await response.json();
//             if (data.success) {
//               socket.emit("messagesRead", { readerId: currentUserId, partnerId, unreadCount: 0 });
//             }
//           }
//         } catch (err) {
//           console.error("Error fetching messages:", err);
//           setMessages([]);
//         }
//       };
//       fetchMessages();
//     }
//   }, [currentUserId, partnerId, ghostMode]);

//   const markAsRead = async () => {
//     try {
//       const response = await fetch(`${BASE_URL}/api/messages/markAsRead`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ currentUserId, partnerId }),
//       });
//       const data = await response.json();
//       if (data.success) {
//         console.log("Messages marked as read:", data);
//         setMessages((prev) =>
//           prev.map((msg) =>
//             msg.fromUserId === partnerId && !msg.isRead
//               ? { ...msg, isRead: true }
//               : msg
//           )
//         );
//         socket.emit("messagesRead", { readerId: currentUserId, partnerId, unreadCount: 0 });
//       } else {
//         console.log("Failed to mark messages as read:", data);
//       }
//     } catch (err) {
//       console.error("Error marking messages as read:", err);
//     }
//   };

//   const handleSendMessage = async (msg) => {
//     if (!currentUserId || !partnerId) return;

//     if (msg.type === "edit") {
//       handleEditMessage(msg.messageId, msg.text);
//       return;
//     }

//     const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

//     const newMessage = {
//       id: tempId,
//       tempId,
//       fromUserId: currentUserId,
//       toUserId: partnerId,
//       text: msg.text || "",
//       type: msg.type || "text",
//       fileUrl: msg.fileUrl || null,
//       filename: msg.filename || null,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       replyToId: reply ? reply.id : null,
//       replyTo: reply
//         ? {
//             id: reply.id,
//             text: reply.text,
//             fromUserId: isLeft ? partnerId : currentUserId,
//           }
//         : null,
//       reactions: [],
//     };

//     setMessages((prev) => [...prev, newMessage]);

//     try {
//       const response = await fetch(`${BASE_URL}/api/messages/sendMessage`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           fromUserId: currentUserId,
//           toUserId: partnerId,
//           text: msg.text || "",
//           type: msg.type || "text",
//           fileUrl: msg.fileUrl || null,
//           filename: msg.filename || null,
//           replyToId: reply ? reply.id : null,
//           tempId,
//         }),
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to send message: ${response.status}`);
//       }

//       const data = await response.json();
//       if (data.success) {
//         const savedMessage = data.message;
//         setMessages((prev) => {
//           const tempIndex = prev.findIndex((m) => m.tempId === tempId);
//           if (tempIndex !== -1) {
//             const updatedMessages = [...prev];
//             updatedMessages[tempIndex] = {
//               ...savedMessage,
//               isRead: savedMessage.isRead,
//               reactions: savedMessage.reactions || [],
//             };
//             return updatedMessages;
//           }
//           return prev;
//         });
//       } else {
//         console.error("Failed to send message:", data.error);
//         setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
//       }
//     } catch (err) {
//       console.error("Error sending message:", err);
//       setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
//     }

//     setReply(null);
//   };

//   const swipeToReply = (message, isLeft) => {
//     const text = message.text
//       ? message.text
//       : message.filename
//       ? message.filename
//       : "";
//     setReply({
//       id: message.id,
//       text: text.length > 50 ? text.slice(0, 50) + "..." : text,
//       username: isLeft ? username : "Вы",
//     });
//     setIsLeft(isLeft);
//   };

//   const handleReply = (message, isLeft) => {
//     swipeToReply(message, isLeft);
//   };

//   const closeReply = () => setReply(null);

//   const handleDeleteMessages = async (messageIds) => {
//     for (const messageId of messageIds) {
//       if (String(messageId).startsWith("temp-")) {
//         console.log(`Cannot delete temporary message with id ${messageId}. Waiting for server confirmation.`);
//         continue;
//       }

//       try {
//         const res = await fetch(`${BASE_URL}/api/messages/deleteMessage?messageId=${messageId}`, {
//           method: "DELETE",
//           headers: { "Content-Type": "application/json" },
//         });

//         if (!res.ok) {
//           const errData = await res.json();
//           console.error(`Delete failed for message ${messageId}: ${JSON.stringify(errData)}`);
//           continue;
//         }

//         const data = await res.json();
//         if (data.success) {
//           console.log(`Delete successful for message ${messageId}`);
//           socket.emit("deleteMessage", { roomName, messageId });
//         } else {
//           console.log(`Delete error for message ${messageId}: ${data.error}`);
//         }
//       } catch (err) {
//         console.error(`Error deleting message ${messageId}:`, err);
//       }
//     }
//     setMessages((prev) => prev.filter((msg) => !messageIds.includes(String(msg.id))));
//   };

//   const startEditingMessage = (messageId, text) => {
//     const messageToEdit = messages.find((m) => m.id === messageId);
//     if (messageToEdit) {
//       setEditingMessage({ ...messageToEdit, text });
//     }
//   };

//   const handleEditMessage = async (messageId, newText) => {
//     fetch(`${BASE_URL}/api/messages/editMessage`, {
//       method: "PUT",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ messageId, newText }),
//     })
//       .then((res) => {
//         if (!res.ok) {
//           return res.json().then((errData) => {
//             console.log("Edit error response:", errData);
//           });
//         }
//         setMessages((prev) =>
//           prev.map((msg) => (msg.id === messageId ? { ...msg, text: newText } : msg))
//         );
//         socket.emit("editMessage", { roomName, messageId, newText });
//         socket.emit("updateLastMessage", { roomName, messageId, newText });
//         setEditingMessage(null);
//       })
//       .catch((err) => console.log("Error editing message:", err));
//   };

//   const handleHighlightMessage = (messageId) => {
//     setHighlightedMessageId(messageId);
//     setTimeout(() => {
//       setHighlightedMessageId(null);
//     }, 1000);
//   };

//   return (
//     <View style={{ flex: 1, backgroundColor: isDarkMode ? "#1C1C1C" : theme.colors.white }}>
//       <ChatHeader
//         username={username}
//         picture={picture}
//         onlineStatus="Online"
//         currentUserId={currentUserId}
//         partnerId={partnerId}
//         selectedMessages={selectedMessages}
//         setSelectedMessages={setSelectedMessages}
//         setMultiSelect={setMultiSelect}
//         onDeleteMessages={handleDeleteMessages}
//         onEditMessage={startEditingMessage}
//         messages={messages}
//       />
//       <MessagesList
//         onSwipeToReply={swipeToReply}
//         messages={messages}
//         currentUserId={currentUserId}
//         onDeleteMessage={handleDeleteMessages}
//         onEditMessage={startEditingMessage}
//         onReplyMessage={handleReply}
//         highlightedMessageId={highlightedMessageId}
//         onHighlightMessage={handleHighlightMessage}
//         isMultiSelect={isMultiSelect}
//         setMultiSelect={setMultiSelect}
//         selectedMessages={selectedMessages}
//         setSelectedMessages={setSelectedMessages}
//       />
//       <ChatInput
//         reply={reply}
//         isLeft={isLeft}
//         closeReply={closeReply}
//         username={username}
//         onSend={handleSendMessage}
//         editingMessage={editingMessage}
//       />
//     </View>
//   );
// };

// export default MessagesScreen;