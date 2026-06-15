"use client"

import { useState, useEffect } from "react"
import { refreshAuthToken } from "../src/authFetch"
import { CommonActions } from "@react-navigation/native"
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  Appearance,
  Platform,
  ScrollView,
} from "react-native"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { useNavigation } from "@react-navigation/native"
import { useTheme } from "../ThemeContext"
import AsyncStorage from "@react-native-async-storage/async-storage"
import i18n from "../i18n"
import { useTranslation } from "react-i18next"
import axios from "axios"
import * as ImagePicker from "expo-image-picker"
import emitter from "./eventEmitter"
import { BASE_URL } from "../src/config";
import socket from "../src/socket";

const ProfScren2 = () => {
  const navigation = useNavigation()
  const { isDarkMode, toggleDarkMode, setIsDarkMode } = useTheme()
  const { t } = useTranslation()

  const [username, setUsername] = useState("")
  const [nickname, setNickname] = useState("")
  const [bio, setBio] = useState("")
  const [profilePicture, setProfilePicture] = useState(null)

  const [initialUsername, setInitialUsername] = useState("")
  const [initialNickname, setInitialNickname] = useState("")
  const [initialBio, setInitialBio] = useState("")

  const [newAvatarUri, setNewAvatarUri] = useState(null)
  const [newAvatarFileInfo, setNewAvatarFileInfo] = useState(null)

  const hasChanges = username !== initialUsername || nickname !== initialNickname || bio !== initialBio || !!newAvatarUri

  const [isLanguageModalVisible, setLanguageModalVisible] = useState(false)
  const [avatarFullscreenVisible, setAvatarFullscreenVisible] = useState(false)

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedMode = await AsyncStorage.getItem("darkMode")
        if (storedMode !== null) {
          setIsDarkMode(JSON.parse(storedMode))
        } else {
          const colorScheme = Appearance.getColorScheme()
          setIsDarkMode(colorScheme === "dark")
        }
      } catch (error) {
        console.error("Error loading mode:", error)
      }
    }
    loadTheme()
  }, [])

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const storedLang = await AsyncStorage.getItem("language")
        if (storedLang) {
          i18n.changeLanguage(storedLang)
        } else {
          const defaultLang = "ru"
          await AsyncStorage.setItem("language", defaultLang)
          i18n.changeLanguage(defaultLang)
        }
      } catch (error) {
        console.error("Error loading language:", error)
      }
    }
    loadLanguage()
  }, [])

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const savedUsername = await AsyncStorage.getItem("username")
        const savedNickname = await AsyncStorage.getItem("nickname")
        const savedAvatar = await AsyncStorage.getItem("avatar")
        const savedBio = await AsyncStorage.getItem("bio")

        if (savedUsername) { setUsername(savedUsername); setInitialUsername(savedUsername); }
        if (savedNickname) { setNickname(savedNickname); setInitialNickname(savedNickname); }
        if (savedAvatar) { setProfilePicture(savedAvatar) }

        // Fetch fresh bio from server
        const userId = await AsyncStorage.getItem("userId")
        if (userId) {
          try {
            const res = await axios.get(`${BASE_URL}/api/users/${userId}`)
            const serverBio = res.data.bio || ""
            setBio(serverBio)
            setInitialBio(serverBio)
            await AsyncStorage.setItem("bio", serverBio)
          } catch {
            const b = savedBio || ""
            setBio(b)
            setInitialBio(b)
          }
        }
      } catch (error) {
        console.error("Error loading profile data:", error)
      }
    }
    loadProfileData()
  }, [])

  const handlePickAvatar = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== "granted") {
          Alert.alert("Permission", "Gallery access permission required")
          return
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'image',
        allowsEditing: true,
        quality: 1,
      })

      if (result.canceled) return
      if (!result.assets || !result.assets[0]) return

      const pickedImage = result.assets[0]
      setNewAvatarUri(pickedImage.uri)

      if (Platform.OS === "web") {
        const response = await fetch(pickedImage.uri)
        const blob = await response.blob()
        const file = new File([blob], "avatar-file", { type: blob.type })
        setNewAvatarFileInfo({ file })
      } else {
        const uri = pickedImage.uri
        const filename = uri.split("/").pop()
        const match = /\.(\w+)$/.exec(filename)
        const fileType = match ? `image/${match[1]}` : `image`

        setNewAvatarFileInfo({
          uri,
          name: filename,
          type: fileType,
        })
      }
    } catch (error) {
      console.error("Error selecting avatar:", error)
      Alert.alert("Error", "Failed to select avatar")
    }
  }

  const handleSaveProfile = async () => {
    try {
      const userId = await AsyncStorage.getItem("userId")
      if (!userId) {
        Alert.alert("Error", "userId not found in AsyncStorage")
        return
      }

      let finalAvatarUrl = profilePicture

      if (newAvatarUri && newAvatarFileInfo) {
        const formData = new FormData()

        if (Platform.OS === "web") {
          formData.append("avatar", newAvatarFileInfo.file)
        } else {
          formData.append("avatar", {
            uri: newAvatarFileInfo.uri,
            name: newAvatarFileInfo.name,
            type: newAvatarFileInfo.type,
          })
        }

        const uploadResponse = await axios.post(`${BASE_URL}/api/users/uploadAvatar`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })

        if (uploadResponse.data && uploadResponse.data.url) {
          finalAvatarUrl = uploadResponse.data.url
        }
      }

      const response = await axios.put(`${BASE_URL}/api/users/updateProfile`, {
        userId,
        username,
        nickname,
        avatar: finalAvatarUrl,
        bio,
      })

      if (response.status === 200) {
        Alert.alert("Profile Updated")

        setProfilePicture(finalAvatarUrl)
        setNewAvatarUri(null)
        setNewAvatarFileInfo(null)
        setInitialUsername(username)
        setInitialNickname(nickname)
        setInitialBio(bio)

        await AsyncStorage.setItem("username", username)
        await AsyncStorage.setItem("nickname", nickname)
        await AsyncStorage.setItem("bio", bio)
        if (finalAvatarUrl) {
          await AsyncStorage.setItem("avatar", finalAvatarUrl)
        } else {
          await AsyncStorage.removeItem("avatar")
        }

        emitter.emit('avatarUpdated', finalAvatarUrl)
      } else {
        Alert.alert("Error", response.data.message || "Error updating profile")
      }
    } catch (error) {
      console.error("Error saving profile:", error)
      Alert.alert("Error", "Failed to save profile")
    }
  }

  const changeLanguage = async (lang) => {
    try {
      await AsyncStorage.setItem("language", lang)
      i18n.changeLanguage(lang)
      setLanguageModalVisible(false)
    } catch (error) {
      console.error("Error saving language:", error)
    }
  }

  const handleGroupPress = () => {
    navigation.navigate("CreateGroupScreen")
  }

  const handleChannelPress = () => {
    navigation.navigate("CreateChannelScreen")
  }

  const handleLogout = async () => {
    try {
      const userId = await AsyncStorage.getItem("userId");

      if (userId && socket.connected) {
        socket.emit('logout', { userId: Number(userId) });
        socket.disconnect();
      }

      await AsyncStorage.removeItem("token");
      refreshAuthToken(); // сбросить токен в fetch-перехватчике
      await AsyncStorage.removeItem("userId");

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Login" }],
        })
      )
    } catch (error) {
      console.error("Error during logout:", error)
      Alert.alert("Error", "Logout failed")
    }
  }

  const currentAvatarForPreview = newAvatarUri ? newAvatarUri : profilePicture

  const settingsItems = [
    {
      key: "privacy",
      icon: "lock-closed-outline",
      iconLib: "ionicons",
      color: "#38d9a9",
      label: t("Privacy"),
      onPress: () => navigation.push("PrivacyScreen"),
    },
    {
      key: "language",
      icon: "language",
      iconLib: "ionicons",
      color: "#f783ac",
      label: t("Language"),
      onPress: () => setLanguageModalVisible(true),
    },
    {
      key: "translation",
      icon: "translate",
      iconLib: "material",
      color: "#845ef7",
      label: "AI Перевод",
      onPress: () => navigation.push("TranslationSettings"),
    },
    {
      key: "group",
      icon: "account-group-outline",
      iconLib: "material",
      color: "#ffa94d",
      label: t("Create Group"),
      onPress: handleGroupPress,
    },
    {
      key: "channel",
      icon: "bullhorn-outline",
      iconLib: "material",
      color: "#748ffc",
      label: t("Create Channel"),
      onPress: handleChannelPress,
    },
    {
      key: "logout",
      icon: "exit-outline",
      iconLib: "ionicons",
      color: "#ff6b6b",
      label: t("Logout"),
      onPress: handleLogout,
    },
  ]

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? "#0B0F19" : "#FFFFFF" }]}>
      {/* Gradient Header */}
      <LinearGradient
        colors={isDarkMode
          ? ['#0B0F19', '#1A2233', '#0B0F19']
          : ['#5B3FE0', '#7C5CFF', '#7C5CFF']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("Profile")}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={toggleDarkMode}>
          <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={[styles.avatarSection, { backgroundColor: isDarkMode ? "#0B0F19" : "#FFFFFF" }]}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              onPress={() => currentAvatarForPreview && setAvatarFullscreenVisible(true)}
              activeOpacity={currentAvatarForPreview ? 0.8 : 1}
            >
              <View style={[styles.avatarRing, { borderColor: '#5B3FE0' }]}>
                {currentAvatarForPreview ? (
                  <Image
                    source={{ uri: currentAvatarForPreview }}
                    style={styles.profilePicture}
                    onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? "#0B0F19" : "#f0f0f0" }]}>
                    <Ionicons name="person" size={48} color={isDarkMode ? "#5B3FE0" : "#adb5bd"} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraIconContainer} onPress={handlePickAvatar} activeOpacity={0.8}>
              <View style={[styles.cameraBadge, { borderColor: isDarkMode ? "#0B0F19" : "#FFFFFF" }]}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
          {username ? (
            <Text style={[styles.avatarName, { color: isDarkMode ? "#ffffff" : "#0B0F19" }]}>{username}</Text>
          ) : null}
          {nickname ? (
            <Text style={[styles.avatarNickname, { color: isDarkMode ? "rgba(255,255,255,0.5)" : "#888" }]}>@{nickname}</Text>
          ) : null}
        </View>

        <View style={styles.content}>
          {/* Input Fields */}
          <View style={styles.inputSection}>
            <View style={[styles.inputContainer, { backgroundColor: isDarkMode ? "#0B0F19" : "#f8f8f8", borderColor: isDarkMode ? "#1A2233" : "#e5e5e5" }]}>
              <View style={[styles.inputIconWrap, { backgroundColor: isDarkMode ? "rgba(121,40,202,0.15)" : "rgba(121,40,202,0.08)" }]}>
                <Ionicons name="person-outline" size={18} color="#5B3FE0" />
              </View>
              <TextInput
                style={[styles.nameInput, { color: isDarkMode ? "#ffffff" : "#333333" }]}
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor={isDarkMode ? "#555" : "#adb5bd"}
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: isDarkMode ? "#0B0F19" : "#f8f8f8", borderColor: isDarkMode ? "#1A2233" : "#e5e5e5" }]}>
              <View style={[styles.inputIconWrap, { backgroundColor: isDarkMode ? "rgba(121,40,202,0.15)" : "rgba(121,40,202,0.08)" }]}>
                <Ionicons name="at-outline" size={18} color="#5B3FE0" />
              </View>
              <TextInput
                style={[styles.nameInput, { color: isDarkMode ? "#ffffff" : "#333333" }]}
                value={nickname}
                onChangeText={setNickname}
                placeholder="Nickname"
                placeholderTextColor={isDarkMode ? "#555" : "#adb5bd"}
              />
            </View>

            <View style={[styles.inputContainer, styles.bioContainer, { backgroundColor: isDarkMode ? "#0B0F19" : "#f8f8f8", borderColor: isDarkMode ? "#1A2233" : "#e5e5e5" }]}>
              <View style={[styles.inputIconWrap, { backgroundColor: isDarkMode ? "rgba(121,40,202,0.15)" : "rgba(121,40,202,0.08)", alignSelf: 'flex-start', marginTop: 14 }]}>
                <Ionicons name="create-outline" size={18} color="#5B3FE0" />
              </View>
              <TextInput
                style={[styles.nameInput, styles.bioInput, { color: isDarkMode ? "#ffffff" : "#333333" }]}
                value={bio}
                onChangeText={setBio}
                placeholder="О себе..."
                placeholderTextColor={isDarkMode ? "#555" : "#adb5bd"}
                multiline
                maxLength={200}
              />
            </View>
          </View>

          {/* Save Button — only when changes exist */}
          {hasChanges && (
            <TouchableOpacity onPress={handleSaveProfile} activeOpacity={0.85}>
              <LinearGradient
                colors={['#5B3FE0', '#7C5CFF', '#7C5CFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>{t("Save_Profile")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Settings */}
          <View style={styles.settingsContainer}>
            <Text style={[styles.settingsTitle, { color: isDarkMode ? "rgba(255,255,255,0.5)" : "#999" }]}>
              {t("Settings").toUpperCase()}
            </Text>

            <View style={[styles.settingsCard, { backgroundColor: isDarkMode ? "#0B0F19" : "#f8f8f8", borderColor: isDarkMode ? "#1A2233" : "#e5e5e5" }]}>
              {settingsItems.map((item, index) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={item.onPress}
                  style={[
                    styles.settingItem,
                    index < settingsItems.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    },
                  ]}
                  activeOpacity={0.6}
                >
                  <View style={[styles.iconContainer, { backgroundColor: item.color + "20" }]}>
                    {item.iconLib === "material" ? (
                      <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                    ) : (
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    )}
                  </View>
                  <Text style={[styles.settingText, { color: isDarkMode ? "#ffffff" : "#333333" }]}>
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={isDarkMode ? "rgba(255,255,255,0.2)" : "#ccc"} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Avatar Fullscreen Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={avatarFullscreenVisible}
        onRequestClose={() => setAvatarFullscreenVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.fullscreenOverlay}
          activeOpacity={1}
          onPress={() => setAvatarFullscreenVisible(false)}
        >
          <Image
            source={{ uri: currentAvatarForPreview }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>

      {/* Language Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isLanguageModalVisible}
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={[styles.modalContainer, { backgroundColor: isDarkMode ? "#0B0F19" : "#ffffff" }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDarkMode ? "rgba(255,255,255,0.15)" : "#ddd" }]} />
            <Text style={[styles.modalTitle, { color: isDarkMode ? "#ffffff" : "#333333" }]}>
              {t("Select Language")}
            </Text>

            <FlatList
              data={[
                { label: "Русский", value: "ru", flag: "🇷🇺" },
                { label: "English", value: "en", flag: "🇺🇸" },
              ]}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, { backgroundColor: isDarkMode ? "rgba(121,40,202,0.08)" : "#f8f7fc" }]}
                  onPress={() => changeLanguage(item.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalFlag}>{item.flag}</Text>
                  <Text style={[styles.modalItemText, { color: isDarkMode ? "#ffffff" : "#333333" }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.value}
            />

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={[styles.modalCloseText, { color: isDarkMode ? "rgba(255,255,255,0.4)" : "#999" }]}>{t("Close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  avatarSection: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 24,
  },
  avatarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    overflow: "hidden",
  },
  profilePicture: {
    width: 114,
    height: 114,
    borderRadius: 57,
  },
  avatarPlaceholder: {
    width: 114,
    height: 114,
    borderRadius: 57,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 4,
    right: 4,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  cameraBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    backgroundColor: "#5B3FE0",
  },
  avatarName: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 14,
  },
  avatarNickname: {
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
  },
  inputIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  bioContainer: {
    alignItems: 'flex-start',
  },
  bioInput: {
    height: 80,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  settingsContainer: {
    width: "100%",
  },
  settingsTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    paddingHorizontal: 4,
    letterSpacing: 1.2,
  },
  settingsCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  settingText: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContainer: {
    borderRadius: 20,
    padding: 24,
    width: 300,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  modalFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  modalCloseButton: {
    paddingVertical: 14,
    marginTop: 8,
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: "600",
  },
})

export default ProfScren2
