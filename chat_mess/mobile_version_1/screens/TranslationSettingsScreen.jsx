import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../src/config';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
];

export default function TranslationSettingsScreen() {
  const navigation = useNavigation();
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();

  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [preferredLang, setPreferredLang] = useState('ru');
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;
      const res = await axios.get(`${BASE_URL}/api/users/${userId}/apiKeyStatus`);
      setHasApiKey(res.data.hasApiKey);
      setPreferredLang(res.data.preferredLanguage || 'ru');
      setAutoTranslate(res.data.autoTranslate || false);
    } catch (err) {
      console.error('Error loading translation settings:', err);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim() && !hasApiKey) return;
    setSaving(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      await axios.put(`${BASE_URL}/api/users/updateApiKey`, {
        userId,
        openaiApiKey: apiKey.trim() || null,
      });
      if (apiKey.trim()) {
        setHasApiKey(true);
        setApiKey('');
        Alert.alert('API ключ сохранён');
      } else {
        setHasApiKey(false);
        Alert.alert('API ключ удалён');
      }
    } catch (err) {
      Alert.alert('Ошибка', err.response?.data?.error || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    Alert.alert('Удалить ключ?', 'Перевод сообщений перестанет работать', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          setSaving(true);
          try {
            const userId = await AsyncStorage.getItem('userId');
            await axios.put(`${BASE_URL}/api/users/updateApiKey`, { userId, openaiApiKey: null });
            setHasApiKey(false);
            setApiKey('');
          } catch (err) {
            Alert.alert('Ошибка', 'Не удалось удалить ключ');
          } finally {
            setSaving(false);
          }
        }
      },
    ]);
  };

  const handleSaveLang = async (langCode) => {
    setPreferredLang(langCode);
    setShowLangPicker(false);
    try {
      const userId = await AsyncStorage.getItem('userId');
      await axios.put(`${BASE_URL}/api/users/updateTranslationSettings`, {
        userId, preferredLanguage: langCode, autoTranslate,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAuto = async (val) => {
    setAutoTranslate(val);
    try {
      const userId = await AsyncStorage.getItem('userId');
      await axios.put(`${BASE_URL}/api/users/updateTranslationSettings`, {
        userId, preferredLanguage: preferredLang, autoTranslate: val,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const selectedLang = LANGUAGES.find(l => l.code === preferredLang) || LANGUAGES[0];

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF' }]}>
      <LinearGradient
        colors={isDarkMode ? ['#0B0F19', '#1A2233', '#0B0F19'] : ['#5B3FE0', '#7C5CFF', '#7C5CFF']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Перевод</Text>
        <View style={styles.headerBtn} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* API Key Section */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#0B0F19' : '#f8f8f8', borderColor: isDarkMode ? '#1A2233' : '#e5e5e5' }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(121,40,202,0.15)' }]}>
              <Ionicons name="key-outline" size={20} color="#5B3FE0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#333' }]}>
                OpenAI API Key
              </Text>
              <Text style={[styles.sectionDesc, { color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#999' }]}>
                {hasApiKey ? 'Ключ установлен' : 'Введите ваш ключ для перевода'}
              </Text>
            </View>
            {hasApiKey && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
          </View>

          <View style={[styles.inputRow, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isDarkMode ? '#1A2233' : '#e5e5e5' }]}>
            <TextInput
              style={[styles.input, { color: isDarkMode ? '#fff' : '#333' }]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder={hasApiKey ? 'sk-•••••••••••••• (заменить)' : 'sk-...'}
              placeholderTextColor={isDarkMode ? '#555' : '#adb5bd'}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowKey(!showKey)} style={styles.eyeBtn}>
              <Ionicons name={showKey ? 'eye-off' : 'eye'} size={20} color={isDarkMode ? '#777' : '#999'} />
            </TouchableOpacity>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSaveKey}
              disabled={saving}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#5B3FE0', '#7C5CFF']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.saveBtnGrad}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {hasApiKey ? 'Обновить' : 'Сохранить'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {hasApiKey && (
              <TouchableOpacity style={styles.removeBtn} onPress={handleRemoveKey} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Language Selection */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? '#0B0F19' : '#f8f8f8', borderColor: isDarkMode ? '#1A2233' : '#e5e5e5' }]}>
          <Text style={[styles.label, { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#999' }]}>
            ЯЗЫК ПЕРЕВОДА
          </Text>

          <TouchableOpacity
            style={[styles.langSelector, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: isDarkMode ? '#1A2233' : '#e5e5e5' }]}
            onPress={() => setShowLangPicker(!showLangPicker)}
            activeOpacity={0.7}
          >
            <Text style={styles.langFlag}>{selectedLang.flag}</Text>
            <Text style={[styles.langLabel, { color: isDarkMode ? '#fff' : '#333' }]}>
              {selectedLang.label}
            </Text>
            <Ionicons name={showLangPicker ? 'chevron-up' : 'chevron-down'} size={18} color={isDarkMode ? '#777' : '#999'} />
          </TouchableOpacity>

          {showLangPicker && (
            <View style={styles.langList}>
              {LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langItem,
                    preferredLang === lang.code && { backgroundColor: isDarkMode ? 'rgba(121,40,202,0.2)' : 'rgba(121,40,202,0.08)' },
                  ]}
                  onPress={() => handleSaveLang(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.langItemFlag}>{lang.flag}</Text>
                  <Text style={[styles.langItemLabel, { color: isDarkMode ? '#fff' : '#333' }]}>
                    {lang.label}
                  </Text>
                  {preferredLang === lang.code && (
                    <Ionicons name="checkmark" size={18} color="#5B3FE0" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Info */}
        <View style={[styles.infoBox, { backgroundColor: isDarkMode ? 'rgba(121,40,202,0.1)' : 'rgba(121,40,202,0.05)' }]}>
          <Ionicons name="information-circle-outline" size={20} color="#5B3FE0" />
          <Text style={[styles.infoText, { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#666' }]}>
            Получите API ключ на platform.openai.com. Ключ хранится на сервере и используется только для перевода ваших сообщений. Используется модель gpt-4o-mini.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  content: { padding: 20 },
  section: {
    borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionDesc: { fontSize: 12, marginTop: 2 },
  activeBadge: {
    backgroundColor: 'rgba(56,217,169,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  activeBadgeText: { color: '#38d9a9', fontSize: 12, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 14 },
  eyeBtn: { padding: 8 },
  btnRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  saveBtn: { flex: 1 },
  saveBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12, gap: 6,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  removeBtn: {
    width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  langSelector: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1,
  },
  langFlag: { fontSize: 20, marginRight: 10 },
  langLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  langList: { marginTop: 8 },
  langItem: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 4,
  },
  langItemFlag: { fontSize: 18, marginRight: 10 },
  langItemLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  infoBox: {
    flexDirection: 'row', padding: 14, borderRadius: 12, gap: 10, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
