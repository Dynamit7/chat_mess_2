import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  SafeAreaView,
} from "react-native";
import axios from "axios";
import io from "socket.io-client";
import Icon from "@expo/vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../src/config";
import { useTheme } from "../ThemeContext";

// const BASE_URL = Platform.select({ web: 'http://192.168.77.41:3000', default: 'http://192.168.77.41:3000' });

function ChannelCommentsScreen({ route, navigation }) {
  const { isDarkMode } = useTheme();
  const { channelId, postId } = route.params;
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [userId, setUserId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    (async () => {
      const storedUserId = await AsyncStorage.getItem("userId");
      if (storedUserId) {
        setUserId(storedUserId);
        checkChannelOwnership(storedUserId);
      }
      fetchComments();
    })();
  }, []);

  useEffect(() => {
    const socketInstance = io(`${BASE_URL}`, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ["websocket"],
      secure: true,
    });
    socketRef.current = socketInstance;

    socketInstance.on("connect_error", (error) => {
      console.log("Socket connection error:", error.message);
      Alert.alert("Ошибка", "Не удалось подключиться к серверу. Попробуйте позже.");
    });

    if (userId) {
      socketInstance.emit("joinChannel", { channelId, userId });
    }

    socketInstance.on("channelMessageReceived", (messageData) => {
      if (
        messageData.channelId === channelId &&
        messageData.parentMessageId == postId
      ) {
        setComments((prev) => {
          // Avoid duplicates by checking if the comment already exists
          if (prev.some((c) => c.id === messageData.id)) {
            return prev;
          }
          return [...prev, messageData];
        });
      }
    });

    socketInstance.on("channelMessageUpdated", (updatedMessage) => {
      if (
        updatedMessage.channelId === channelId &&
        updatedMessage.parentMessageId == postId
      ) {
        setComments((prev) =>
          prev.map((c) => (c.id === updatedMessage.id ? updatedMessage : c))
        );
      }
    });

    socketInstance.on("channelMessageDeleted", ({ messageId }) => {
      setComments((prev) => prev.filter((c) => String(c.id) !== messageId));
    });

    socketInstance.on("channelCommentsCleared", ({ messageId }) => {
      if (String(messageId) === String(postId)) {
        setComments([]);
      }
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [channelId, postId, userId]);

  const checkChannelOwnership = async (userId) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/channels/id/${channelId}`);
      setIsOwner(String(res.data.ownerId) === String(userId));
    } catch (error) {
      console.log("Ошибка при проверке владельца канала:", error.response?.data || error.message);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/channels/${channelId}/message/${postId}/comments`
      );
      setComments(res.data);
    } catch (error) {
      console.log(
        "Ошибка при загрузке комментариев:",
        error.response?.data || error.message
      );
      Alert.alert("Ошибка", "Не удалось загрузить комментарии");
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    try {
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("text", newComment);
      const response = await axios.post(
        `${BASE_URL}/api/channels/${channelId}/message/${postId}/comment`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      // Manually append the comment to avoid relying solely on socket
      setComments((prev) => {
        if (prev.some((c) => c.id === response.data.id)) {
          return prev;
        }
        return [...prev, response.data];
      });
      setNewComment("");
    } catch (err) {
      console.log("Ошибка при отправке комментария:", err.response?.data || err.message);
      Alert.alert("Ошибка", "Не удалось отправить комментарий. Попробуйте снова.");
    }
  };

  const handleDeleteComment = async (comment) => {
    try {
      await axios.delete(
        `${BASE_URL}/api/channels/${channelId}/message/${comment.id}`,
        { data: { userId } }
      );
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch (err) {
      console.log("Ошибка при удалении комментария:", err.response?.data || err.message);
      Alert.alert("Ошибка", "Не удалось удалить комментарий");
    }
  };

  const handleEditComment = async (commentId) => {
    const t = editText.trim();
    if (!t) return;
    try {
      await axios.put(
        `${BASE_URL}/api/channels/${channelId}/message/${commentId}`,
        { userId, text: t }
      );
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, text: t } : c))
      );
      setEditingId(null);
      setEditText("");
    } catch (err) {
      console.log("Ошибка при редактировании комментария:", err.response?.data || err.message);
      Alert.alert("Ошибка", "Не удалось сохранить изменения");
    }
  };

  const handleDeleteAllComments = async () => {
    Alert.alert(
      "Подтверждение",
      "Вы уверены, что хотите удалить все комментарии к этому посту?",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(
                `${BASE_URL}/api/channels/${channelId}/message/${postId}/comments`,
                { data: { userId } }
              );
              setComments([]);
            } catch (err) {
              console.log("Ошибка при удалении всех комментариев:", err.response?.data || err.message);
              Alert.alert("Ошибка", "Не удалось удалить комментарии");
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isMine = String(item.userId) === String(userId);
    const canDelete = isMine || isOwner;
    const canEdit = isMine;
    const isEditing = editingId === item.id;
    const displayName = isMine ? "Вы" : item.sender?.username || `Пользователь #${item.userId}`;
    const initials = displayName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return (
      <View style={styles.commentRow}>
        <View style={[styles.avatar, isMine && styles.avatarMine]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View
          style={[
            styles.commentContainer,
            isMine ? styles.myComment : [styles.otherComment, isDarkMode && { backgroundColor: '#121826', borderColor: '#1A2233' }],
          ]}
        >
          <View style={styles.commentHeader}>
            <Text
              style={[
                styles.authorName,
                isMine ? styles.myAuthorName : [styles.otherAuthorName, isDarkMode && { color: '#a0a0b0' }],
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {canEdit && !isEditing && (
                <TouchableOpacity onPress={() => { setEditingId(item.id); setEditText(item.text || ""); }}>
                  <Icon name="pencil" size={14} color={isMine ? "#FCE4EC" : "#7C5CFF"} />
                </TouchableOpacity>
              )}
              {canDelete && !isEditing && (
                <TouchableOpacity onPress={() => handleDeleteComment(item)}>
                  <Icon name="trash" size={14} color={isMine ? "#FCE4EC" : "#7C5CFF"} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {isEditing ? (
            <View>
              <TextInput
                value={editText}
                onChangeText={setEditText}
                autoFocus
                multiline
                style={[
                  styles.editInput,
                  isMine ? { color: "#F9F4FF", borderColor: "rgba(255,255,255,0.3)" } : { color: "#332E54", borderColor: "rgba(124,92,255,0.3)" },
                  isDarkMode && !isMine && { color: "#e0e0e0" },
                ]}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <TouchableOpacity
                  onPress={() => handleEditComment(item.id)}
                  disabled={!editText.trim()}
                  style={[styles.editBtn, { backgroundColor: isMine ? "rgba(255,255,255,0.2)" : "#7C5CFF" }]}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Сохранить</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEditingId(null); setEditText(""); }}
                  style={[styles.editBtn, { backgroundColor: "rgba(0,0,0,0.1)" }]}
                >
                  <Text style={{ color: isMine ? "#FCE4EC" : "#7C5CFF", fontSize: 13 }}>Отмена</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text
              style={[
                styles.commentText,
                isMine ? styles.myCommentText : [styles.otherCommentText, isDarkMode && { color: '#e0e0e0' }],
              ]}
            >
              {item.text}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#0B0F19' : '#F2EFFA' }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.inner}>
            <View style={[styles.header, isDarkMode && { backgroundColor: '#0B0F19' }]}>
              <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
                <Icon name="arrow-left" size={18} color="#fff" />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerLabel}>Комментарии</Text>
                <Text style={styles.headerTitle}>Пост #{postId}</Text>
              </View>
              {isOwner && (
                <TouchableOpacity style={styles.headerButton} onPress={handleDeleteAllComments}>
                  <Icon name="trash" size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.listCard, isDarkMode && { backgroundColor: '#0B0F19' }]}>
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                style={styles.commentList}
                contentContainerStyle={[
                  styles.commentListContent,
                  comments.length === 0 && styles.emptyListContent,
                ]}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Icon name="comments" size={36} color="#B39DDB" />
                    <Text style={styles.emptyTitle}>Пока нет сообщений</Text>
                    <Text style={styles.emptySubtitle}>
                      Напишите что-нибудь и начните обсуждение.
                    </Text>
                  </View>
                }
              />
            </View>

            <View style={[styles.inputBar, isDarkMode && { backgroundColor: '#121826' }]}>
              <TextInput
                style={[styles.textInput, isDarkMode && { color: '#e0e0e0' }]}
                placeholder="Написать комментарий..."
                value={newComment}
                onChangeText={setNewComment}
                placeholderTextColor={isDarkMode ? '#666' : "#A4A3BA"}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
                onPress={handleSendComment}
                disabled={!newComment.trim()}
              >
                <Icon name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default ChannelCommentsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2EFFA",
  },
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#7C5CFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 12,
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  listCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  commentList: {
    flex: 1,
  },
  commentListContent: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4C3D91",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8C86A6",
    textAlign: "center",
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginVertical: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DAD1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMine: {
    backgroundColor: "#B39DDB",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
  },
  commentContainer: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  myComment: {
    backgroundColor: "#7C5CFF",
  },
  otherComment: {
    backgroundColor: "#F8F7FF",
    borderWidth: 1,
    borderColor: "rgba(124, 92, 255, 0.2)",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "600",
  },
  myAuthorName: {
    color: "rgba(255,255,255,0.85)",
  },
  otherAuthorName: {
    color: "#4C3D91",
  },
  commentText: {
    fontSize: 15,
    lineHeight: 22,
  },
  myCommentText: {
    color: "#F9F4FF",
  },
  otherCommentText: {
    color: "#332E54",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1E1B3C",
    paddingRight: 12,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: "#D6C8FF",
    shadowOpacity: 0,
    elevation: 0,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
    minHeight: 60,
  },
  editBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
});