import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../ThemeContext";
import * as ImagePicker from "expo-image-picker";
import { BASE_URL } from "../src/config";

function CreateGroupScreen({ navigation }) {
  const [userId, setUserId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [chats, setChats] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [nicknameSearch, setNicknameSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const { isDarkMode } = useTheme();

  const colors = {
    bg: isDarkMode ? "#0B0F19" : "#F5F3FF",
    surface: isDarkMode ? "#121826" : "#FFFFFF",
    surfaceElevated: isDarkMode ? "#1F1F3A" : "#FAFAFE",
    text: isDarkMode ? "#F0EEFF" : "#1A1035",
    textSecondary: isDarkMode ? "#9B97B8" : "#6B6490",
    border: isDarkMode ? "#2A2A4A" : "#E8E4F8",
    placeholder: isDarkMode ? "#5A5680" : "#A8A3C0",
    gradient1: "#5B3FE0",
    gradient2: "#7C5CFF",
    gradient3: "#C9B8FF",
    accent: "#5B3FE0",
    accentLight: isDarkMode ? "rgba(124, 58, 237, 0.15)" : "rgba(124, 58, 237, 0.08)",
    switchTrackOff: isDarkMode ? "#2A2A4A" : "#D4D0E8",
  };

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem("userId");
        if (storedUserId) setUserId(storedUserId);
      } catch (err) {
        console.log("Ошибка при получении userId:", err);
      }
    };

    const loadChats = async () => {
      try {
        const storedChats = await AsyncStorage.getItem("chats");
        if (storedChats) setChats(JSON.parse(storedChats));
      } catch (err) {
        console.log("Ошибка при загрузке чатов:", err);
      }
    };

    loadUserId();
    loadChats();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (nicknameSearch.trim().length > 0) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [nicknameSearch]);

  const handleSearch = async () => {
    setLoadingSearch(true);
    try {
      const response = await axios.get(
        `${BASE_URL}/api/users/search?nickname=${nicknameSearch}&requesterId=${userId}`
      );
      setSearchResults(response.data);
    } catch (error) {
      console.log("Ошибка поиска пользователей:", error);
    } finally {
      setLoadingSearch(false);
    }
  };

  const toggleSelectMember = (id) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter((memberId) => memberId !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  const pickImage = async () => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Для выбора изображения необходимо разрешить доступ к галерее!");
      return;
    }
    const mediaTypeImages =
      ImagePicker.MediaType && ImagePicker.MediaType.Images
        ? ImagePicker.MediaType.Images
        : ImagePicker.MediaTypeOptions.Images;
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypeImages,
      allowsEditing: true,
      quality: 1,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      if (asset.base64) {
        setAvatar(`data:image/jpeg;base64,${asset.base64}`);
      } else {
        setAvatar(asset.uri);
      }
    }
  };

  const onCreateGroup = async () => {
    if (!userId) return;
    if (!name.trim()) {
      alert("Пожалуйста, введите название группы");
      return;
    }
    if (selectedMembers.length === 0) {
      alert("Пожалуйста, выберите хотя бы одного участника");
      return;
    }

    setIsCreating(true);

    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("name", name);
    formData.append("description", description);
    formData.append("isPublic", isPublic);
    formData.append("members", JSON.stringify(selectedMembers));

    if (avatar) {
      if (avatar.startsWith("data:")) {
        try {
          const response = await fetch(avatar);
          const blob = await response.blob();
          formData.append("avatar", blob, "avatar.jpg");
        } catch (error) {
          console.log("Ошибка конвертации data URL в Blob:", error);
        }
      } else {
        const localUri = avatar;
        const filename = localUri.split("/").pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        formData.append("avatar", { uri: localUri, name: filename, type });
      }
    }

    try {
      const response = await axios.post(
        `${BASE_URL}/api/groups`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("Группа создана:", response.data);
      navigation.goBack();
    } catch (err) {
      console.log(
        "Ошибка при создании группы:",
        err.response?.data || err.message
      );
      alert("Не удалось создать группу. Пожалуйста, попробуйте снова.");
    } finally {
      setIsCreating(false);
    }
  };

  if (!userId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const visibleSearchResults = searchResults.filter(
    (item) => item.statusVisibility === "Все"
  );

  const renderUserItem = (item, idKey = "id") => {
    const id = item[idKey];
    const isSelected = selectedMembers.includes(id);
    const displayName = item.nickname || item.username || `User#${id}`;
    const subText = item.username && item.nickname ? item.username : null;

    return (
      <TouchableOpacity
        style={[
          styles.listItem,
          {
            backgroundColor: isSelected ? colors.accentLight : colors.surface,
            borderColor: isSelected ? colors.accent : colors.border,
            borderWidth: 1,
          },
        ]}
        onPress={() => toggleSelectMember(id)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          <LinearGradient
            colors={isSelected ? [colors.gradient1, colors.gradient2] : [colors.border, colors.border]}
            style={styles.userAvatar}
          >
            <Text style={[styles.userInitial, { color: isSelected ? "#fff" : colors.textSecondary }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={styles.userTextInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {displayName}
            </Text>
            {subText && (
              <Text style={[styles.userSubInfo, { color: colors.textSecondary }]}>
                {subText}
              </Text>
            )}
          </View>
        </View>
        <View style={[
          styles.checkbox,
          isSelected
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { backgroundColor: 'transparent', borderColor: colors.border }
        ]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Создание группы
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Avatar */}
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer} activeOpacity={0.8}>
            {avatar ? (
              <View style={styles.avatarWrapper}>
                <LinearGradient
                  colors={[colors.gradient1, colors.gradient2, colors.gradient3]}
                  style={styles.avatarGradientBorder}
                >
                  <View style={[styles.avatarInner, { backgroundColor: colors.bg }]}>
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                  </View>
                </LinearGradient>
              </View>
            ) : (
              <View style={styles.avatarWrapper}>
                <LinearGradient
                  colors={[colors.gradient1, colors.gradient2, colors.gradient3]}
                  style={styles.avatarGradientBorder}
                >
                  <View style={[styles.avatarPlaceholderInner, { backgroundColor: colors.bg }]}>
                    <LinearGradient
                      colors={[colors.accentLight, 'transparent']}
                      style={styles.avatarGlow}
                    />
                    <Ionicons name="camera" size={32} color={colors.accent} />
                    <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                      Добавить фото
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            )}
          </TouchableOpacity>

          {/* Info Section */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={[colors.gradient1, colors.gradient2]}
                style={styles.sectionDot}
              />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Информация о группе
              </Text>
            </View>

            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.inputRow}>
                <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                  <Ionicons name="people" size={18} color={colors.accent} />
                </View>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Название группы"
                  placeholderTextColor={colors.placeholder}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={[styles.inputRow, { alignItems: 'flex-start' }]}>
                <View style={[styles.iconCircle, { backgroundColor: colors.accentLight, marginTop: 2 }]}>
                  <Ionicons name="document-text" size={18} color={colors.accent} />
                </View>
                <TextInput
                  style={[styles.input, { color: colors.text, height: 80, textAlignVertical: 'top', paddingTop: 0 }]}
                  placeholder="Описание группы"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.switchRow}>
                <View style={styles.switchLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                    <Ionicons name="globe-outline" size={18} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>
                      Публичная группа
                    </Text>
                    <Text style={[styles.switchHint, { color: colors.textSecondary }]}>
                      {isPublic ? "Все могут найти и вступить" : "Только по приглашению"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: colors.switchTrackOff, true: colors.accent }}
                  thumbColor="#fff"
                  ios_backgroundColor={colors.switchTrackOff}
                />
              </View>
            </View>
          </View>

          {/* Members Section */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <LinearGradient
                colors={[colors.gradient1, colors.gradient2]}
                style={styles.sectionDot}
              />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Участники группы
              </Text>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.placeholder} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Поиск по nickname..."
                placeholderTextColor={colors.placeholder}
                value={nicknameSearch}
                onChangeText={setNicknameSearch}
              />
              {nicknameSearch.length > 0 && (
                <TouchableOpacity onPress={() => setNicknameSearch("")}>
                  <Ionicons name="close-circle" size={18} color={colors.placeholder} />
                </TouchableOpacity>
              )}
            </View>

            {loadingSearch && (
              <View style={styles.loadingSearchContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.loadingSearchText, { color: colors.textSecondary }]}>
                  Поиск...
                </Text>
              </View>
            )}

            {selectedMembers.length > 0 && (
              <LinearGradient
                colors={[colors.accentLight, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.selectedBadge, { borderColor: colors.accent }]}
              >
                <Ionicons name="people" size={16} color={colors.accent} />
                <Text style={[styles.selectedBadgeText, { color: colors.accent }]}>
                  {selectedMembers.length} выбрано
                </Text>
              </LinearGradient>
            )}

            {nicknameSearch.trim().length > 0 ? (
              <View style={styles.listContainer}>
                <FlatList
                  data={visibleSearchResults}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => renderUserItem(item, "id")}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    !loadingSearch && (
                      <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="search-outline" size={36} color={colors.placeholder} />
                        <Text style={[styles.emptyText, { color: colors.placeholder }]}>
                          Нет результатов
                        </Text>
                      </View>
                    )
                  }
                />
              </View>
            ) : (
              <View style={styles.listContainer}>
                <Text style={[styles.subHeader, { color: colors.textSecondary }]}>
                  Выберите участников из ваших чатов:
                </Text>
                <FlatList
                  data={chats}
                  keyExtractor={(item) => String(item.partnerId)}
                  renderItem={({ item }) => renderUserItem(item, "partnerId")}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="chatbubble-outline" size={36} color={colors.placeholder} />
                      <Text style={[styles.emptyText, { color: colors.placeholder }]}>
                        У вас пока нет чатов
                      </Text>
                    </View>
                  }
                />
              </View>
            )}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            onPress={onCreateGroup}
            disabled={isCreating}
            activeOpacity={0.85}
            style={{ marginTop: 8, marginBottom: 32 }}
          >
            <LinearGradient
              colors={isCreating ? [colors.placeholder, colors.placeholder] : [colors.gradient1, colors.gradient2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButton}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={22} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.createButtonText}>Создать группу</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Avatar
  avatarContainer: {
    alignSelf: "center",
    marginVertical: 28,
  },
  avatarWrapper: {
    alignItems: "center",
  },
  avatarGradientBorder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInner: {
    width: 124,
    height: 124,
    borderRadius: 62,
    overflow: "hidden",
  },
  avatar: {
    width: 124,
    height: 124,
    borderRadius: 62,
  },
  avatarPlaceholderInner: {
    width: 124,
    height: 124,
    borderRadius: 62,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarGlow: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 62,
  },
  avatarText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // Form
  formSection: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  inputCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  switchLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  switchHint: {
    fontSize: 12,
    marginTop: 2,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
  },
  loadingSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  loadingSearchText: {
    marginLeft: 8,
    fontSize: 13,
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 14,
  },
  selectedBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },

  // List
  listContainer: {
    marginBottom: 4,
  },
  subHeader: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  userInitial: {
    fontSize: 17,
    fontWeight: "700",
  },
  userTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
  },
  userSubInfo: {
    fontSize: 13,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    padding: 36,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "500",
  },

  // Button
  createButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: "#5B3FE0",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default CreateGroupScreen;
