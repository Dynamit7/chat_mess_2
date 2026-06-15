import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../ThemeContext";
import { BASE_URL } from "../src/config";
import axios from "axios";

export default function UserProfileScreen({ route, navigation }) {
  const { userId, username: initialUsername, picture: initialPicture } = route.params;
  const { isDarkMode } = useTheme();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarFullscreen, setAvatarFullscreen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/users/${userId}`);
        setUser(res.data);
      } catch (err) {
        console.log("Ошибка загрузки профиля пользователя:", err.message);
        // Fallback to data passed via params
        setUser({ id: userId, username: initialUsername, avatar: initialPicture, nickname: null });
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId]);

  const avatar = user?.avatar || initialPicture;
  const username = user?.username || initialUsername;
  const nickname = user?.nickname;
  const bio = user?.bio;
  const lastSeenDate = user?.lastSeen ? new Date(user.lastSeen) : null;

  const formatLastSeen = (date) => {
    if (!date) return null;
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч. назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? "#0B0F19" : "#F0F2F5" }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={isDarkMode ? ['#0B0F19', '#1A2233'] : ['#5B3FE0', '#7C5CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль</Text>
        <View style={styles.backBtn} />
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5B3FE0" />
        </View>
      ) : (
        <View style={styles.content}>
          {/* Avatar */}
          <TouchableOpacity
            activeOpacity={avatar ? 0.8 : 1}
            onPress={() => avatar && setAvatarFullscreen(true)}
            style={styles.avatarWrapper}
          >
            <View style={[styles.avatarRing, { borderColor: '#5B3FE0' }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <LinearGradient colors={['#5B3FE0', '#9070FF']} style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>
                    {username?.[0]?.toUpperCase() || '?'}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </TouchableOpacity>

          {/* Name & nickname */}
          <Text style={[styles.username, { color: isDarkMode ? '#fff' : '#0B0F19' }]}>
            {username}
          </Text>
          {nickname ? (
            <Text style={[styles.nickname, { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#888' }]}>
              @{nickname}
            </Text>
          ) : null}

          {/* Last seen */}
          {formatLastSeen(lastSeenDate) ? (
            <Text style={[styles.lastSeen, { color: isDarkMode ? 'rgba(255,255,255,0.35)' : '#aaa' }]}>
              Был(а) {formatLastSeen(lastSeenDate)}
            </Text>
          ) : null}

          {/* Bio */}
          {bio ? (
            <View style={[styles.bioCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <Text style={[styles.bioText, { color: isDarkMode ? 'rgba(255,255,255,0.75)' : '#444' }]}>
                {bio}
              </Text>
            </View>
          ) : null}

          {/* Message button */}
          <TouchableOpacity
            style={styles.msgBtnWrapper}
            activeOpacity={0.85}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={['#5B3FE0', '#9070FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.msgBtn}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.msgBtnText}>Написать сообщение</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Fullscreen avatar modal */}
      <Modal
        visible={avatarFullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarFullscreen(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.fullscreenOverlay}
          activeOpacity={1}
          onPress={() => setAvatarFullscreen(false)}
        >
          <Image
            source={{ uri: avatar }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 36,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    marginBottom: 16,
  },
  avatarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 114,
    height: 114,
    borderRadius: 57,
  },
  avatarPlaceholder: {
    width: 114,
    height: 114,
    borderRadius: 57,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  nickname: {
    fontSize: 15,
    marginBottom: 8,
  },
  lastSeen: {
    fontSize: 12,
    marginBottom: 16,
  },
  bioCard: {
    width: '100%',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  msgBtnWrapper: {
    marginTop: 8,
    width: '100%',
  },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
  },
  msgBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
