import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../ThemeContext";
import socket from "../src/socket";
import { BASE_URL } from "../src/config";

function GroupEditScreen({ route, navigation }) {
  const { groupId } = route.params;
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [carouselImages, setCarouselImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const { isDarkMode } = useTheme();

  const themeColors = {
    background: isDarkMode ? "#0A0A0F" : "#F0F2F5",
    card: isDarkMode ? "#0B0F19" : "#FFFFFF",
    text: isDarkMode ? "#EAEAEF" : "#121826",
    subtext: isDarkMode ? "#8888A0" : "#6B7280",
    border: isDarkMode ? "#1A2233" : "#E5E7EB",
    inputBg: isDarkMode ? "#121826" : "#F8F9FB",
    inputBorder: isDarkMode ? "#1A2233" : "#E5E7EB",
    primary: "#7C5CFF",
    primaryLight: isDarkMode ? "#7C5CFF20" : "#7C5CFF10",
    secondary: "#AD94FF",
    danger: "#FF6B6B",
    switchTrack: isDarkMode ? "#1A2233" : "#E5E7EB",
    switchActive: "#AD94FF",
  };

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/groups/id/${groupId}`);
        const group = res.data;
        setGroupName(group.name);
        setDescription(group.description || "");
        setIsPublic(group.isPublic);
        if (group.avatar) {
          const avatarUri = group.avatar.startsWith("http") ? group.avatar : `${BASE_URL}${group.avatar}`;
          setCarouselImages([avatarUri]);
        }
      } catch (err) {
        console.log("Ошибка при загрузке группы:", err.response?.data || err.message);
      }
    };
    fetchGroup();
  }, [groupId]);

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.cancelled && result.assets && result.assets[0]) {
        setCarouselImages([result.assets[0].uri, ...carouselImages]);
      }
    }
  };

  const handleFileInput = (event) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setCarouselImages([previewUrl, ...carouselImages]);
    }
  };

  const removeImage = (index) => {
    const newImages = carouselImages.filter((_, i) => i !== index);
    setCarouselImages(newImages);
    if (index === 0 && selectedFile) {
      setSelectedFile(null);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem("userId");
      let formData = new FormData();
      formData.append("name", groupName);
      formData.append("description", description);
      formData.append("isPublic", isPublic);
      formData.append("userId", userId);

      if (selectedFile) {
        formData.append("avatar", selectedFile);
      }
      else if (carouselImages.length > 0 && !carouselImages[0].startsWith("http")) {
        let localUri = carouselImages[0];
        let filename = localUri.split("/").pop();
        let match = /\.(\w+)$/.exec(filename);
        let type = match ? `image/${match[1]}` : `image`;
        formData.append("avatar", {
          uri: localUri,
          name: filename,
          type,
        });
      }

      const res = await axios.put(`${BASE_URL}/api/groups/${groupId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      socket.emit("groupUpdated", {
        groupId,
        updatedFields: { name: groupName, avatar: res.data.avatar },
      });

      Alert.alert("Группа обновлена", "Изменения сохранены", [
        {
          text: "OK",
          onPress: () =>
            navigation.navigate("GroupProfileScreen", { groupId }),
        },
      ]);
    } catch (error) {
      console.log("Ошибка при обновлении группы:", error.response?.data || error.message);
      Alert.alert("Ошибка", "Не удалось обновить группу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.background }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, { backgroundColor: themeColors.card }]}
        >
          <Ionicons name="chevron-back" size={22} color={themeColors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: themeColors.text }]}>
          Редактировать группу
        </Text>

        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Avatar Preview */}
        <View style={styles.avatarPreviewSection}>
          {carouselImages.length > 0 ? (
            <View style={styles.avatarPreviewWrapper}>
              <Image
                source={{ uri: carouselImages[0] }}
                style={styles.avatarPreview}
              />
              <TouchableOpacity
                style={styles.avatarRemoveBtn}
                onPress={() => removeImage(0)}
              >
                <Ionicons name="close" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <LinearGradient
              colors={["#7C5CFF", "#AD94FF"]}
              style={styles.avatarPreview}
            >
              <Ionicons name="camera-outline" size={36} color="#FFF" />
            </LinearGradient>
          )}

          {Platform.OS === "web" ? (
            <TouchableOpacity style={[styles.changeAvatarBtn, { backgroundColor: themeColors.primaryLight }]}>
              <Ionicons name="image-outline" size={18} color={themeColors.primary} />
              <Text style={[styles.changeAvatarText, { color: themeColors.primary }]}>
                Изменить фото
              </Text>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                style={styles.hiddenInput}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.changeAvatarBtn, { backgroundColor: themeColors.primaryLight }]}
              onPress={pickImage}
            >
              <Ionicons name="image-outline" size={18} color={themeColors.primary} />
              <Text style={[styles.changeAvatarText, { color: themeColors.primary }]}>
                Изменить фото
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Form Card */}
        <View style={[styles.formCard, { backgroundColor: themeColors.card }]}>
          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.subtext }]}>
              Название группы
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder }]}>
              <Ionicons name="people-outline" size={18} color={themeColors.subtext} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: themeColors.text }]}
                placeholder="Введите название"
                value={groupName}
                onChangeText={setGroupName}
                placeholderTextColor={themeColors.subtext}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.subtext }]}>
              Описание
            </Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder }]}>
              <TextInput
                style={[styles.input, styles.textArea, { color: themeColors.text }]}
                placeholder="Расскажите о группе..."
                value={description}
                onChangeText={setDescription}
                multiline
                placeholderTextColor={themeColors.subtext}
              />
            </View>
          </View>

          {/* Public Switch */}
          <View style={[styles.switchRow, { borderTopColor: themeColors.border }]}>
            <View style={styles.switchInfo}>
              <View style={[styles.switchIconCircle, { backgroundColor: themeColors.primaryLight }]}>
                <Ionicons
                  name={isPublic ? "globe-outline" : "lock-closed-outline"}
                  size={18}
                  color={themeColors.primary}
                />
              </View>
              <View>
                <Text style={[styles.switchTitle, { color: themeColors.text }]}>
                  {isPublic ? "Публичная группа" : "Приватная группа"}
                </Text>
                <Text style={[styles.switchSubtext, { color: themeColors.subtext }]}>
                  {isPublic ? "Видна всем пользователям" : "Только по приглашению"}
                </Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: themeColors.switchTrack, true: themeColors.switchActive }}
              thumbColor={isPublic ? themeColors.primary : themeColors.subtext}
            />
          </View>
        </View>

        {/* Save Button */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.subtext }]}>
              Сохранение...
            </Text>
          </View>
        ) : (
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <LinearGradient
              colors={["#7C5CFF", "#AD94FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
              <Text style={styles.saveBtnText}>Сохранить изменения</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  // Avatar Preview
  avatarPreviewSection: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  avatarPreviewWrapper: {
    position: "relative",
  },
  avatarPreview: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarRemoveBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  changeAvatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
    position: "relative",
    overflow: "hidden",
  },
  changeAvatarText: {
    fontSize: 14,
    fontWeight: "600",
  },
  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    cursor: "pointer",
  },
  // Form Card
  formCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  textAreaWrapper: {
    alignItems: "flex-start",
    paddingTop: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  // Switch
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
  },
  switchInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  switchIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  switchSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  // Save
  saveBtn: {
    marginTop: 4,
  },
  saveBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
  },
});

export default GroupEditScreen;
