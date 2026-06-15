import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from "react-native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket from "../src/socket";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { BASE_URL } from "../src/config";

function ChannelProfileScreen({ route, navigation }) {
  const { channelId } = route.params;
  const [channel, setChannel] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const { isDarkMode } = useTheme();

  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [channelSettingsModalVisible, setChannelSettingsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const themeColors = {
    background: isDarkMode ? "#0A0A0F" : "#F0F2F5",
    card: isDarkMode ? "#0B0F19" : "#FFFFFF",
    cardElevated: isDarkMode ? "#1C1C28" : "#FFFFFF",
    text: isDarkMode ? "#EAEAEF" : "#121826",
    subtext: isDarkMode ? "#8888A0" : "#6B7280",
    border: isDarkMode ? "#1A2233" : "#E5E7EB",
    primary: "#7C5CFF",
    primaryLight: isDarkMode ? "#7C5CFF20" : "#7C5CFF10",
    secondary: "#AD94FF",
    danger: "#FF6B6B",
    dangerLight: isDarkMode ? "#FF6B6B20" : "#FF6B6B10",
    inputBg: isDarkMode ? "#121826" : "#F3F4F6",
  };

  useEffect(() => {
    const fetchChannelData = async () => {
      try {
        const resChannel = await axios.get(
          `${BASE_URL}/api/channels/id/${channelId}`
        );
        setChannel(resChannel.data);

        const storedUserId = await AsyncStorage.getItem("userId");
        const resMembers = await axios.get(
          `${BASE_URL}/api/channels/members/${channelId}`,
          { params: { userId: storedUserId } }
        );
        setMembers(Array.isArray(resMembers.data) ? resMembers.data : []);
      } catch (error) {
        console.log(
          "Ошибка при загрузке данных канала:",
          error.response?.data || error.message
        );
      }
    };
    fetchChannelData();
    const unsubscribe = navigation.addListener('focus', fetchChannelData);
    return unsubscribe;
  }, [channelId, navigation]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId");
        if (storedUserId) {
          setCurrentUserId(Number(storedUserId));
          socket.emit("joinRoom", `user_${storedUserId}`);
        }
      } catch (error) {
        console.error("Ошибка получения userId:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  const openChatWithMember = (member) => {
    if (!currentUserId) {
      console.log("currentUserId не найден");
      return;
    }
    socket.emit("startChat", {
      fromUserId: currentUserId,
      toUserId: member.id,
    });
    navigation.navigate("MessagesScreen", {
      id: member.id,
      username: member.username,
      bio: member.bio || "",
      picture: member.avatar || "https://via.placeholder.com/40",
    });
  };

  const removeMember = async (memberId) => {
    if (!channel || !currentUserId) return;
    try {
      const res = await axios.delete(
        `${BASE_URL}/api/channels/${channelId}/members/${memberId}`,
        { data: { userId: currentUserId } }
      );
      setMembers(members.filter((m) => m.id !== memberId));
      console.log(res.data.message);
    } catch (error) {
      console.log(
        "Ошибка при удалении подписчика:",
        error.response?.data || error.message
      );
    }
  };

  const getSubscriberCountText = (count) => {
    if (count === 1) return "подписчик";
    if (count >= 2 && count <= 4) return "подписчика";
    return "подписчиков";
  };

  const renderMember = ({ item }) => {
    if (!item) return null;
    const isOwner = item.id === channel?.ownerId;
    return (
      <TouchableOpacity
        style={[styles.memberCard, { backgroundColor: themeColors.cardElevated }]}
        onPress={() => openChatWithMember(item)}
        activeOpacity={0.7}
      >
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatarWrapper}>
            {item.avatar ? (
              <Image
                style={styles.memberAvatar}
                source={{ uri: item.avatar }}
              />
            ) : (
              <LinearGradient
                colors={isOwner ? ["#7C5CFF", "#AD94FF"] : ["#00B4DB", "#0083B0"]}
                style={styles.memberAvatar}
              >
                <Text style={styles.memberAvatarText}>
                  {item.username?.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            {isOwner && (
              <View style={[styles.ownerBadge, { backgroundColor: "#FFD700" }]}>
                <Ionicons name="star" size={8} color="#FFF" />
              </View>
            )}
          </View>
          <View style={styles.memberTextContainer}>
            <Text style={[styles.memberName, { color: themeColors.text }]}>
              {item.username}
            </Text>
            {isOwner && (
              <View style={styles.adminTagRow}>
                <LinearGradient
                  colors={["#7C5CFF", "#AD94FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.adminTag}
                >
                  <Text style={styles.adminTagText}>Владелец</Text>
                </LinearGradient>
              </View>
            )}
          </View>
        </View>
        {channel?.ownerId === currentUserId && item.id !== currentUserId && (
          <TouchableOpacity
            onPress={() => removeMember(item.id)}
            style={[styles.removeButton, { backgroundColor: themeColors.dangerLight }]}
          >
            <Ionicons name="person-remove-outline" size={16} color={themeColors.danger} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const openAddMemberModal = () => {
    setModalVisible(true);
    setSearchQuery("");
    setSearchResults([]);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const delayDebounce = setTimeout(() => {
      axios
        .get(`${BASE_URL}/api/users/search?nickname=${searchQuery}&requesterId=${currentUserId}`)
        .then((res) => {
          setSearchResults(res.data);
          setIsSearching(false);
        })
        .catch((err) => {
          console.log(
            "Ошибка при поиске пользователей:",
            err.response?.data || err.message
          );
          setIsSearching(false);
        });
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleAddMember = async (user) => {
    try {
      const res = await axios.post(
        `${BASE_URL}/api/channels/${channelId}/join`,
        { userId: user.id, addedBy: currentUserId }
      );
      console.log("Пользователь добавлен:", res.data);
      setMembers([...members, user]);
      setSearchResults(searchResults.filter((u) => u.id !== user.id));
    } catch (error) {
      console.log(
        "Ошибка при добавлении подписчика:",
        error.response?.data || error.message
      );
    }
  };

  const handleEditChannel = () => {
    setChannelSettingsModalVisible(false);
    navigation.navigate("ChannelEditScreen", { channelId: channel.id });
  };

  const handleDeleteChannel = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Вы уверены, что хотите удалить канал?")) {
        axios
          .delete(`${BASE_URL}/api/channels/${channel.id}`, {
            data: { userId: currentUserId },
          })
          .then((res) => {
            console.log("Delete response:", res.data);
            window.alert("Канал удалён");
            setChannelSettingsModalVisible(false);
            navigation.navigate("Home", { screen: "Channels" });
          })
          .catch((error) => {
            console.log(
              "Ошибка при удалении канала:",
              error.response?.data || error.message
            );
            window.alert(
              error.response?.data?.error || "Ошибка при удалении канала"
            );
          });
      }
    } else {
      Alert.alert(
        "Подтверждение",
        "Вы уверены, что хотите удалить канал?",
        [
          { text: "Отмена", style: "cancel" },
          {
            text: "Удалить",
            style: "destructive",
            onPress: async () => {
              try {
                const res = await axios.delete(
                  `${BASE_URL}/api/channels/${channel.id}`,
                  {
                    data: { userId: currentUserId },
                  }
                );
                console.log("Delete response:", res.data);
                Alert.alert("Канал удалён");
                setChannelSettingsModalVisible(false);
                navigation.navigate("Home", { screen: "Channels" });
              } catch (error) {
                console.log(
                  "Ошибка при удалении канала:",
                  error.response?.data || error.message
                );
                Alert.alert(
                  "Ошибка",
                  error.response?.data?.error || "Ошибка при удалении канала"
                );
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleLeaveChannel = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Вы уверены, что хотите выйти из канала?")) {
        axios
          .delete(`${BASE_URL}/api/channels/${channel.id}/leave`, {
            data: { userId: currentUserId },
          })
          .then((res) => {
            console.log("Leave response:", res.data);
            window.alert("Вы вышли из канала");
            setChannelSettingsModalVisible(false);
            navigation.navigate("Home", { screen: "Channels" });
          })
          .catch((error) => {
            console.log(
              "Ошибка при выходе из канала:",
              error.response?.data || error.message
            );
            window.alert(
              error.response?.data?.error || "Ошибка при выходе из канала"
            );
          });
      }
    } else {
      Alert.alert(
        "Подтверждение",
        "Вы уверены, что хотите выйти из канала?",
        [
          { text: "Отмена", style: "cancel" },
          {
            text: "Выйти",
            style: "destructive",
            onPress: async () => {
              try {
                const res = await axios.delete(
                  `${BASE_URL}/api/channels/${channel.id}/leave`,
                  {
                    data: { userId: currentUserId },
                  }
                );
                console.log("Leave response:", res.data);
                Alert.alert("Вы вышли из канала");
                setChannelSettingsModalVisible(false);
                navigation.navigate("Home", { screen: "Channels" });
              } catch (error) {
                console.log(
                  "Ошибка при выходе из канала:",
                  error.response?.data || error.message
                );
                Alert.alert(
                  "Ошибка",
                  error.response?.data?.error || "Ошибка при выходе из канала"
                );
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={themeColors.background}
      />
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerBtn, { backgroundColor: themeColors.card }]}
          >
            <Ionicons name="chevron-back" size={22} color={themeColors.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: themeColors.text }]}>
            Профиль канала
          </Text>

          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: themeColors.card }]}
            onPress={() => setChannelSettingsModalVisible(true)}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={themeColors.text} />
          </TouchableOpacity>
        </View>

        {channel && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Profile Hero */}
            <View style={[styles.heroCard, { backgroundColor: themeColors.card }]}>
              <LinearGradient
                colors={isDarkMode ? ["#7C5CFF30", "#AD94FF10"] : ["#7C5CFF15", "#AD94FF08"]}
                style={styles.heroBanner}
              />

              <TouchableOpacity
                onPress={() => channel.avatar && setIsImageModalVisible(true)}
                style={styles.heroAvatarWrapper}
              >
                <View style={styles.avatarRing}>
                  {channel.avatar ? (
                    <Image
                      style={styles.heroAvatar}
                      source={{ uri: `${BASE_URL}${channel.avatar}` }}
                    />
                  ) : (
                    <LinearGradient
                      colors={["#7C5CFF", "#AD94FF"]}
                      style={styles.heroAvatar}
                    >
                      <Text style={styles.heroAvatarText}>
                        {channel.name.charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
              </TouchableOpacity>

              <Text style={[styles.heroName, { color: themeColors.text }]}>
                {channel.name}
              </Text>

              {channel.description ? (
                <Text style={[styles.heroDescription, { color: themeColors.subtext }]}>
                  {channel.description}
                </Text>
              ) : null}

              {/* Stats Row */}
              <View style={styles.statsContainer}>
                <View style={[styles.statItem, { backgroundColor: themeColors.primaryLight }]}>
                  <Ionicons name="people" size={16} color={themeColors.primary} />
                  <Text style={[styles.statsText, { color: themeColors.primary }]}>
                    {members.length} {getSubscriberCountText(members.length)}
                  </Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: themeColors.primaryLight }]}>
                  <Ionicons name="megaphone" size={16} color={themeColors.primary} />
                  <Text style={[styles.statsText, { color: themeColors.primary }]}>
                    Канал
                  </Text>
                </View>
              </View>

              {channel.ownerId === currentUserId && (
                <TouchableOpacity onPress={openAddMemberModal} style={styles.addMemberBtn}>
                  <LinearGradient
                    colors={["#7C5CFF", "#AD94FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addMemberGradient}
                  >
                    <Ionicons name="person-add" size={18} color="#FFF" />
                    <Text style={styles.addMemberBtnText}>Добавить подписчика</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Subscribers Section */}
            <View style={styles.membersSection}>
              <View style={styles.membersSectionHeader}>
                <Text style={[styles.membersSectionTitle, { color: themeColors.text }]}>
                  Подписчики
                </Text>
                <View style={[styles.memberCountBadge, { backgroundColor: themeColors.primaryLight }]}>
                  <Text style={[styles.memberCountText, { color: themeColors.primary }]}>
                    {members.length}
                  </Text>
                </View>
              </View>

              {members.map((item) => (
                <React.Fragment key={item.id.toString()}>
                  {renderMember({ item })}
                </React.Fragment>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Image Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isImageModalVisible}
          onRequestClose={() => setIsImageModalVisible(false)}
        >
          <BlurView intensity={90} style={styles.imageModalOverlay} tint={isDarkMode ? "dark" : "light"}>
            <TouchableOpacity
              style={styles.closeImageBtn}
              onPress={() => setIsImageModalVisible(false)}
            >
              <View style={styles.closeImageBtnBg}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {channel?.avatar && (
              <Image
                style={styles.fullImage}
                source={{ uri: `${BASE_URL}${channel.avatar}` }}
                resizeMode="contain"
              />
            )}
          </BlurView>
        </Modal>

        {/* Settings Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={channelSettingsModalVisible}
          onRequestClose={() => setChannelSettingsModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.settingsOverlay}
            activeOpacity={1}
            onPress={() => setChannelSettingsModalVisible(false)}
          >
            <View style={[styles.settingsModal, { backgroundColor: themeColors.card }]}>
              <View style={[styles.settingsHandle, { backgroundColor: themeColors.border }]} />
              <Text style={[styles.settingsTitle, { color: themeColors.text }]}>
                Настройки канала
              </Text>

              {channel?.ownerId === currentUserId ? (
                <>
                  <TouchableOpacity
                    style={[styles.settingsItem, { backgroundColor: themeColors.primaryLight }]}
                    onPress={handleEditChannel}
                  >
                    <View style={[styles.settingsIconCircle, { backgroundColor: themeColors.primary }]}>
                      <Ionicons name="create-outline" size={18} color="#FFF" />
                    </View>
                    <Text style={[styles.settingsItemText, { color: themeColors.text }]}>
                      Редактировать канал
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.subtext} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.settingsItem, { backgroundColor: themeColors.dangerLight }]}
                    onPress={handleDeleteChannel}
                  >
                    <View style={[styles.settingsIconCircle, { backgroundColor: themeColors.danger }]}>
                      <Ionicons name="trash-outline" size={18} color="#FFF" />
                    </View>
                    <Text style={[styles.settingsItemText, { color: themeColors.danger }]}>
                      Удалить канал
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.danger} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.settingsItem, { backgroundColor: themeColors.dangerLight }]}
                  onPress={handleLeaveChannel}
                >
                  <View style={[styles.settingsIconCircle, { backgroundColor: themeColors.danger }]}>
                    <Ionicons name="exit-outline" size={18} color="#FFF" />
                  </View>
                  <Text style={[styles.settingsItemText, { color: themeColors.danger }]}>
                    Выйти из канала
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={themeColors.danger} />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Add Subscriber Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={closeModal}
        >
          <View style={styles.addMemberOverlay}>
            <View style={[styles.addMemberModal, { backgroundColor: themeColors.card }]}>
              <View style={[styles.settingsHandle, { backgroundColor: themeColors.border, alignSelf: "center", marginBottom: 16 }]} />

              <View style={styles.addMemberHeader}>
                <Text style={[styles.addMemberTitle, { color: themeColors.text }]}>
                  Добавить подписчика
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close-circle" size={28} color={themeColors.subtext} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg }]}>
                <Ionicons name="search" size={18} color={themeColors.subtext} />
                <TextInput
                  style={[styles.searchInput, { color: themeColors.text }]}
                  placeholder="Поиск по nickname..."
                  placeholderTextColor={themeColors.subtext}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color={themeColors.subtext} />
                  </TouchableOpacity>
                )}
              </View>

              {isSearching && (
                <ActivityIndicator size="small" color={themeColors.primary} style={{ marginVertical: 12 }} />
              )}

              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => {
                  const alreadyMember = members.some((m) => m.id === item.id);
                  return (
                    <View style={[styles.searchResultItem, { borderBottomColor: themeColors.border }]}>
                      <View style={styles.searchResultInfo}>
                        {item.avatar ? (
                          <Image
                            style={styles.searchResultAvatar}
                            source={{ uri: item.avatar }}
                          />
                        ) : (
                          <LinearGradient
                            colors={["#00B4DB", "#0083B0"]}
                            style={styles.searchResultAvatar}
                          >
                            <Text style={styles.searchResultAvatarText}>
                              {item.username?.charAt(0).toUpperCase()}
                            </Text>
                          </LinearGradient>
                        )}
                        <View>
                          <Text style={[styles.searchResultName, { color: themeColors.text }]}>
                            {item.username}
                          </Text>
                          <Text style={[styles.searchResultNickname, { color: themeColors.subtext }]}>
                            @{item.nickname}
                          </Text>
                        </View>
                      </View>

                      {alreadyMember ? (
                        <View style={[styles.alreadyBadge, { backgroundColor: themeColors.primaryLight }]}>
                          <Text style={[styles.alreadyBadgeText, { color: themeColors.primary }]}>
                            В канале
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => handleAddMember(item)}>
                          <LinearGradient
                            colors={["#7C5CFF", "#AD94FF"]}
                            style={styles.addResultBtn}
                          >
                            <Ionicons name="add" size={18} color="#FFF" />
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
                ListEmptyComponent={() =>
                  searchQuery.trim().length > 0 && !isSearching ? (
                    <View style={styles.emptySearchContainer}>
                      <Ionicons name="search-outline" size={40} color={themeColors.subtext} />
                      <Text style={[styles.emptySearchText, { color: themeColors.subtext }]}>
                        Пользователь не найден
                      </Text>
                    </View>
                  ) : null
                }
                style={styles.searchResultsList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  // Hero Card
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  heroBanner: {
    height: 80,
    width: "100%",
  },
  heroAvatarWrapper: {
    alignItems: "center",
    marginTop: -55,
    marginBottom: 12,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 65,
    backgroundColor: "transparent",
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  heroAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
  },
  heroAvatarText: {
    fontSize: 44,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  heroName: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  heroDescription: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  statsText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addMemberBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  addMemberGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  addMemberBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  // Members Section
  membersSection: {
    paddingHorizontal: 16,
  },
  membersSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  membersSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  memberCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  memberCountText: {
    fontSize: 13,
    fontWeight: "700",
  },
  // Member Card
  memberCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  memberAvatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
  },
  ownerBadge: {
    position: "absolute",
    bottom: 0,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0B0F19",
  },
  memberTextContainer: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "600",
  },
  adminTagRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  adminTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminTagText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  // Image Modal
  imageModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeImageBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeImageBtnBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "90%",
    height: "70%",
    borderRadius: 16,
  },
  // Settings Modal
  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  settingsModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  settingsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  settingsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingsItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  // Add Member Modal
  addMemberOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  addMemberModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    maxHeight: "80%",
  },
  addMemberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addMemberTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
  },
  searchResultsList: {
    maxHeight: 350,
  },
  searchResultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchResultInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  searchResultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  searchResultAvatarText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: "600",
  },
  searchResultNickname: {
    fontSize: 12,
    marginTop: 2,
  },
  alreadyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  alreadyBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  addResultBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  emptySearchContainer: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 10,
  },
  emptySearchText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
});

export default ChannelProfileScreen;
