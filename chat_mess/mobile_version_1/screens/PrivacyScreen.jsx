import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  StyleSheet,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { BASE_URL } from "../src/config";

const PrivacyScreen = () => {
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'Все',
    statusVisibility: 'Все',
    photoVisibility: 'Все',
  });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isOnlineVisible, setIsOnlineVisible] = useState(true);
  const [isReadReceiptsEnabled, setIsReadReceiptsEnabled] = useState(true);
  const [isTwoFactorAuthEnabled, setIsTwoFactorAuthEnabled] = useState(false);
  const [isPrivacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorPasswordConfirm, setTwoFactorPasswordConfirm] = useState('');
  const { isDarkMode } = useTheme();

  const [isAuthModalVisible, setAuthModalVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [twoFactorPasswordVisible, setTwoFactorPasswordVisible] = useState(false);

  const navigation = useNavigation();

  const colors = {
    bg: isDarkMode ? "#0B0F19" : "#F5F3FF",
    surface: isDarkMode ? "#121826" : "#FFFFFF",
    text: isDarkMode ? "#F0EEFF" : "#1A1035",
    textSecondary: isDarkMode ? "#9B97B8" : "#6B6490",
    border: isDarkMode ? "#2A2A4A" : "#E8E4F8",
    placeholder: isDarkMode ? "#5A5680" : "#A8A3C0",
    gradient1: "#5B3FE0",
    gradient2: "#7C5CFF",
    accent: "#5B3FE0",
    accentLight: isDarkMode ? "rgba(124, 58, 237, 0.15)" : "rgba(124, 58, 237, 0.08)",
    danger: "#EF4444",
    dangerLight: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.08)",
    switchTrackOff: isDarkMode ? "#2A2A4A" : "#D4D0E8",
    modalOverlay: "rgba(0, 0, 0, 0.6)",
    modalBg: isDarkMode ? "#121826" : "#FFFFFF",
  };

  const settingLabels = {
    profileVisibility: 'Видимость профиля',
    statusVisibility: 'Видимость статуса',
    photoVisibility: 'Видимость фото',
  };

  const settingIcons = {
    profileVisibility: 'person-outline',
    statusVisibility: 'radio-button-on-outline',
    photoVisibility: 'image-outline',
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem('privacySettings');
        if (storedSettings) setPrivacySettings(JSON.parse(storedSettings));

        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          const blockedRes = await axios.get(`${BASE_URL}/api/users/blockedUsers?userId=${userId}`);
          setBlockedUsers(blockedRes.data || []);

          const res = await axios.get(`${BASE_URL}/api/users/${userId}/privacy`);
          const { ghostMode, readReceiptSetting, statusVisibility, profileVisibility, photoVisibility } = res.data;
          setIsOnlineVisible(!ghostMode);
          setIsReadReceiptsEnabled(readReceiptSetting !== 'nobody');
          await AsyncStorage.setItem('ghostMode', JSON.stringify(ghostMode));
          await AsyncStorage.setItem('readReceiptsEnabled', JSON.stringify(readReceiptSetting !== 'nobody'));

          // Sync visibility settings from server
          const serverSettings = {
            profileVisibility: profileVisibility || 'Все',
            statusVisibility: statusVisibility || 'Все',
            photoVisibility: photoVisibility || 'Все',
          };
          setPrivacySettings(serverSettings);
          await AsyncStorage.setItem('privacySettings', JSON.stringify(serverSettings));

          const twoFactorRes = await axios.get(`${BASE_URL}/auth/two-factor-status/${userId}`);
          setIsTwoFactorAuthEnabled(twoFactorRes.data.twoFactorEnabled);
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
      }
    };
    loadSettings();
  }, []);

  const updatePrivacySetting = async (key, value) => {
    const updatedSettings = { ...privacySettings, [key]: value };
    setPrivacySettings(updatedSettings);
    await AsyncStorage.setItem('privacySettings', JSON.stringify(updatedSettings));

    try {
      const userId = await AsyncStorage.getItem('userId');
      await axios.put(`${BASE_URL}/api/users/updatePrivacy`, {
        userId,
        statusVisibility: updatedSettings.statusVisibility,
        profileVisibility: updatedSettings.profileVisibility,
        photoVisibility: updatedSettings.photoVisibility,
      });
    } catch (error) {
      console.log("Ошибка обновления настроек на сервере:", error);
    }
  };

  const toggleTwoFactorAuth = async () => {
    setPassword('');
    setTwoFactorPassword('');
    setTwoFactorPasswordConfirm('');
    setPasswordVisible(false);
    setTwoFactorPasswordVisible(false);
    setAuthModalVisible(true);
  };

  const handleTwoFactorAuth = async () => {
    if (!password.trim()) {
      Alert.alert('Ошибка', 'Введите пароль от аккаунта');
      return;
    }

    try {
      const userId = await AsyncStorage.getItem('userId');

      if (isTwoFactorAuthEnabled) {
        const res = await axios.post(`${BASE_URL}/auth/disable-two-factor`, {
          userId,
          password,
        });
        if (res.data.twoFactorEnabled === false) {
          setIsTwoFactorAuthEnabled(false);
          Alert.alert('Двухэтапная аутентификация', 'Двухэтапная аутентификация отключена.');
          setAuthModalVisible(false);
        }
      } else {
        if (!twoFactorPassword.trim()) {
          Alert.alert('Ошибка', 'Введите пароль для двухэтапной аутентификации');
          return;
        }
        if (twoFactorPassword.length < 4) {
          Alert.alert('Ошибка', 'Пароль должен быть не менее 4 символов');
          return;
        }
        if (twoFactorPassword !== twoFactorPasswordConfirm) {
          Alert.alert('Ошибка', 'Пароли не совпадают');
          return;
        }

        const res = await axios.post(`${BASE_URL}/auth/setup-two-factor`, {
          userId,
          password,
          twoFactorPassword,
        });
        if (res.data.twoFactorEnabled === true) {
          setIsTwoFactorAuthEnabled(true);
          Alert.alert('Двухэтапная аутентификация', 'Двухэтапная аутентификация включена. При входе на новом устройстве потребуется ввести этот пароль.');
          setAuthModalVisible(false);
        }
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        Alert.alert('Ошибка', 'Неверный пароль от аккаунта');
      } else {
        Alert.alert('Ошибка', 'Не удалось обновить настройки');
      }
    }
  };

  const handleToggleOnlineVisible = async (newValue) => {
    setIsOnlineVisible(newValue);
    const ghostMode = !newValue;
    try {
      const userId = await AsyncStorage.getItem('userId');
      await AsyncStorage.setItem('ghostMode', JSON.stringify(ghostMode));
      await axios.put(`${BASE_URL}/api/users/updateGhostMode`, {
        userId,
        ghostMode,
      });
    } catch (error) {
      console.log("Ошибка обновления статуса онлайн:", error);
    }
  };

  const handleToggleReadReceipts = async (newValue) => {
    setIsReadReceiptsEnabled(newValue);
    const setting = newValue ? 'everyone' : 'nobody';
    try {
      const userId = await AsyncStorage.getItem('userId');
      await AsyncStorage.setItem('readReceiptsEnabled', JSON.stringify(newValue));
      await axios.put(`${BASE_URL}/api/users/updateReadReceipts`, {
        userId,
        readReceiptSetting: setting,
      });
    } catch (error) {
      console.log("Ошибка обновления уведомлений о прочтении:", error);
    }
  };

  const unblockUser = async (user) => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      await axios.post(`${BASE_URL}/api/users/unblockUser`, {
        blockerId: Number(userId),
        blockedId: user.id,
      });
      setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Ошибка разблокировки:', error);
    }
  };

  const privacyOptions = ['Все', 'Только друзья', 'Никто'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

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
          Конфиденциальность
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Privacy Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={[colors.gradient1, colors.gradient2]}
              style={styles.sectionDot}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Приватность профиля
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setPrivacyModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="shield-outline" size={18} color={colors.accent} />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Настройки видимости
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  Профиль, статус, фото
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Toggles Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={[colors.gradient1, colors.gradient2]}
              style={styles.sectionDot}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Активность
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                  <Ionicons name="radio-button-on" size={16} color={colors.accent} />
                </View>
                <View>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    Статус «в сети»
                  </Text>
                  <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                    {isOnlineVisible ? "Виден всем" : "Скрыт"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isOnlineVisible}
                onValueChange={handleToggleOnlineVisible}
                trackColor={{ false: colors.switchTrackOff, true: colors.accent }}
                thumbColor="#fff"
                ios_backgroundColor={colors.switchTrackOff}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                  <Ionicons name="checkmark-done" size={16} color={colors.accent} />
                </View>
                <View>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    Уведомления о прочтении
                  </Text>
                  <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                    {isReadReceiptsEnabled ? "Включены" : "Выключены"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isReadReceiptsEnabled}
                onValueChange={handleToggleReadReceipts}
                trackColor={{ false: colors.switchTrackOff, true: colors.accent }}
                thumbColor="#fff"
                ios_backgroundColor={colors.switchTrackOff}
              />
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={[colors.gradient1, colors.gradient2]}
              style={styles.sectionDot}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Безопасность
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={toggleTwoFactorAuth}
            activeOpacity={0.7}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, { backgroundColor: isTwoFactorAuthEnabled ? colors.accentLight : colors.dangerLight }]}>
                <Ionicons
                  name={isTwoFactorAuthEnabled ? "lock-closed" : "lock-open-outline"}
                  size={18}
                  color={isTwoFactorAuthEnabled ? colors.accent : colors.danger}
                />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Двухфакторная аутентификация
                </Text>
                <Text style={[styles.cardSubtitle, { color: isTwoFactorAuthEnabled ? colors.accent : colors.textSecondary }]}>
                  {isTwoFactorAuthEnabled ? "Включена" : "Выключена"}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: isTwoFactorAuthEnabled ? colors.accentLight : colors.dangerLight }
              ]}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: isTwoFactorAuthEnabled ? colors.accent : colors.danger }
                ]} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Blocked Users Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient
              colors={[colors.gradient1, colors.gradient2]}
              style={styles.sectionDot}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Заблокированные
            </Text>
            {blockedUsers.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.accentLight }]}>
                <Text style={[styles.countBadgeText, { color: colors.accent }]}>
                  {blockedUsers.length}
                </Text>
              </View>
            )}
          </View>

          {blockedUsers.length > 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {blockedUsers.map((user, index) => {
                const displayName = user.nickname ? `@${user.nickname}` : user.username;
                return (
                  <View key={user.id}>
                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    <View style={styles.blockedUserRow}>
                      <View style={styles.blockedUserLeft}>
                        <View style={[styles.blockedUserAvatar, { backgroundColor: colors.dangerLight }]}>
                          <Text style={[styles.blockedUserInitial, { color: colors.danger }]}>
                            {(user.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={[styles.blockedUserName, { color: colors.text }]}>
                            {displayName}
                          </Text>
                          {user.nickname && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 12 }}>
                              {user.username}
                            </Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => unblockUser(user)}
                        style={[styles.unblockButton, { backgroundColor: colors.accentLight }]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.unblockText, { color: colors.accent }]}>
                          Разблокировать
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="happy-outline" size={32} color={colors.placeholder} />
              <Text style={[styles.emptyText, { color: colors.placeholder }]}>
                Нет заблокированных пользователей
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 2FA Modal */}
      <Modal
        visible={isAuthModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAuthModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="shield-checkmark" size={28} color={colors.accent} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Двухэтапная аутентификация
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {isTwoFactorAuthEnabled
                ? 'Введите пароль аккаунта для отключения'
                : 'Установите пароль, который будет запрашиваться при входе на новом устройстве'}
            </Text>

            <View style={[styles.passwordContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Ionicons name="key-outline" size={18} color={colors.placeholder} />
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                secureTextEntry={!passwordVisible}
                placeholder="Пароль от аккаунта"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
                <Ionicons
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.placeholder}
                />
              </TouchableOpacity>
            </View>

            {!isTwoFactorAuthEnabled && (
              <>
                <View style={[styles.passwordContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.placeholder} />
                  <TextInput
                    style={[styles.passwordInput, { color: colors.text }]}
                    secureTextEntry={!twoFactorPasswordVisible}
                    placeholder="Новый пароль для 2FA"
                    placeholderTextColor={colors.placeholder}
                    value={twoFactorPassword}
                    onChangeText={setTwoFactorPassword}
                  />
                  <TouchableOpacity onPress={() => setTwoFactorPasswordVisible(!twoFactorPasswordVisible)}>
                    <Ionicons
                      name={twoFactorPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.placeholder}
                    />
                  </TouchableOpacity>
                </View>

                <View style={[styles.passwordContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.placeholder} />
                  <TextInput
                    style={[styles.passwordInput, { color: colors.text }]}
                    secureTextEntry={!twoFactorPasswordVisible}
                    placeholder="Повторите пароль для 2FA"
                    placeholderTextColor={colors.placeholder}
                    value={twoFactorPasswordConfirm}
                    onChangeText={setTwoFactorPasswordConfirm}
                  />
                </View>
              </>
            )}

            <TouchableOpacity onPress={handleTwoFactorAuth} activeOpacity={0.85}>
              <LinearGradient
                colors={[colors.gradient1, colors.gradient2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalConfirmButton}
              >
                <Text style={styles.modalConfirmText}>
                  {isTwoFactorAuthEnabled ? 'Отключить' : 'Включить'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setAuthModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                Отмена
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Privacy Settings Modal */}
      <Modal
        visible={isPrivacyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.privacyModalContent, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
            <View style={styles.modalHandle}>
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.privacyModalTitleRow}>
              <View style={[styles.privacyModalIcon, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="eye-outline" size={22} color={colors.accent} />
              </View>
              <Text style={[styles.privacyModalTitle, { color: colors.text }]}>
                Настройки видимости
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.keys(privacySettings).map((key, groupIndex) => (
                <View key={key} style={[
                  styles.privacyOptionGroup,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                ]}>
                  <View style={styles.privacyOptionHeader}>
                    <View style={[styles.iconCircleSmall, { backgroundColor: colors.accentLight }]}>
                      <Ionicons name={settingIcons[key]} size={14} color={colors.accent} />
                    </View>
                    <Text style={[styles.privacyOptionTitle, { color: colors.text }]}>
                      {settingLabels[key]}
                    </Text>
                  </View>

                  {privacyOptions.map((option, optIndex) => {
                    const isActive = privacySettings[key] === option;
                    const optionIcons = {
                      'Все': 'globe-outline',
                      'Только друзья': 'people-outline',
                      'Никто': 'lock-closed-outline',
                    };
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => updatePrivacySetting(key, option)}
                        style={[
                          styles.privacyOptionRow,
                          isActive && { backgroundColor: colors.accentLight },
                          optIndex < privacyOptions.length - 1 && !isActive && {
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          },
                        ]}
                        activeOpacity={0.6}
                      >
                        <View style={styles.privacyOptionLeft}>
                          <Ionicons
                            name={optionIcons[option]}
                            size={18}
                            color={isActive ? colors.accent : colors.textSecondary}
                          />
                          <Text style={[
                            styles.privacyOptionText,
                            { color: isActive ? colors.text : colors.textSecondary },
                            isActive && { fontWeight: '600' },
                          ]}>
                            {option}
                          </Text>
                        </View>
                        <View style={[
                          styles.radioOuter,
                          { borderColor: isActive ? colors.accent : colors.border },
                        ]}>
                          {isActive && (
                            <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setPrivacyModalVisible(false)}
              activeOpacity={0.85}
              style={{ marginTop: 20 }}
            >
              <LinearGradient
                colors={[colors.gradient1, colors.gradient2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalConfirmButton}
              >
                <Text style={styles.modalConfirmText}>Готово</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Sections
  section: {
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

  // Cards
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  cardTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  // Status badge
  statusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Toggles
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 14,
  },
  toggleHint: {
    fontSize: 12,
    marginTop: 2,
    marginLeft: 14,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },

  // Blocked users
  blockedUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  blockedUserLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  blockedUserAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  blockedUserInitial: {
    fontSize: 16,
    fontWeight: "700",
  },
  blockedUserName: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 12,
  },
  unblockButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  unblockText: {
    fontSize: 13,
    fontWeight: "600",
  },
  countBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "500",
  },

  // Modal common
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },

  // 2FA Modal
  modalContent: {
    width: "85%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: "100%",
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
    marginRight: 10,
  },
  modalConfirmButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    shadowColor: "#5B3FE0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  modalConfirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalCancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "500",
  },

  // Privacy Modal
  privacyModalContent: {
    width: "90%",
    maxHeight: "75%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
  },
  modalHandle: {
    alignItems: "center",
    marginBottom: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  privacyModalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 10,
  },
  privacyModalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  privacyModalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  privacyOptionGroup: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  privacyOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  privacyOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 10,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  privacyOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  privacyOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  privacyOptionText: {
    fontSize: 15,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export default PrivacyScreen;
