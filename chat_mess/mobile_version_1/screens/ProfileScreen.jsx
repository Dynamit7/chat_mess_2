import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme, THEME_MODES } from '../ThemeContext';

export default function ProfileScreen({ navigation }) {
  const [name, setName] = useState('Иван');
  const [surname, setSurname] = useState('Иванов');
  const [editingName, setEditingName] = useState(false);
  const [editingSurname, setEditingSurname] = useState(false);

  const { currentTheme, themeMode, cycleTheme, isDarkMode, isOledMode } = useTheme();

  const getThemeInfo = () => {
    if (isOledMode) return { icon: 'brightness-1', label: 'OLED' };
    if (isDarkMode) return { icon: 'weather-night', label: 'Dark' };
    return { icon: 'weather-sunny', label: 'Light' };
  };
  const themeInfo = getThemeInfo();

  const settingsItems = [
    { icon: themeInfo.icon, label: `Theme: ${themeInfo.label}`, hint: 'Tap to switch', onPress: cycleTheme },
    { icon: 'message-text-outline', label: 'Chat Settings', onPress: () => navigation.navigate('ChatSettings') },
    { icon: 'shield-lock-outline', label: 'Privacy', onPress: () => {} },
    { icon: 'translate', label: 'Language', onPress: () => {} },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDarkMode ? '#0B0F19' : '#FAFBFE' }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <View style={[styles.backCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <Icon name="arrow-left" size={22} color={isDarkMode ? '#fff' : '#1E293B'} />
        </View>
      </TouchableOpacity>

      {/* Profile header */}
      <LinearGradient
        colors={isDarkMode ? ['#0B0F19', '#1A2233'] : ['#5B3FE0', '#7C5CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.avatarWrapper}>
          <Image
            style={styles.avatar}
            source={{
              uri: 'https://images.pexels.com/photos/28999324/pexels-photo-28999324.jpeg?auto=compress&cs=tinysrgb&w=600&lazy=load',
            }}
          />
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.nameRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={editingName}
            style={[styles.nameInput, editingName && styles.nameInputEditing]}
          />
          <TouchableOpacity onPress={() => setEditingName(!editingName)} style={styles.editButton}>
            <Icon name={editingName ? "check" : "pencil-outline"} size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <View style={styles.nameRow}>
          <TextInput
            value={surname}
            onChangeText={setSurname}
            editable={editingSurname}
            style={[styles.surnameInput, editingSurname && styles.nameInputEditing]}
          />
          <TouchableOpacity onPress={() => setEditingSurname(!editingSurname)} style={styles.editButton}>
            <Icon name={editingSurname ? "check" : "pencil-outline"} size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Settings */}
      <View style={styles.settingsContainer}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8' }]}>
          SETTINGS
        </Text>
        <View style={[styles.settingsCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}>
          {settingsItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.settingOption,
                index < settingsItems.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F5F7FA',
                },
              ]}
              onPress={item.onPress}
            >
              <View style={[styles.settingIconCircle, { backgroundColor: isDarkMode ? 'rgba(124, 92, 255, 0.15)' : 'rgba(124, 92, 255, 0.08)' }]}>
                <Icon name={item.icon} size={20} color="#7C5CFF" />
              </View>
              <Text style={[styles.settingText, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
                {item.label}
              </Text>
              {item.hint ? (
                <Text style={styles.settingHint}>{item.hint}</Text>
              ) : (
                <Icon name="chevron-right" size={20} color={isDarkMode ? 'rgba(255,255,255,0.2)' : '#CBD5E1'} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8}>
        <LinearGradient
          colors={['#EF4444', '#DC2626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.logoutGradient}
        >
          <Icon name="logout" size={18} color="#fff" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 20,
    zIndex: 10,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ADE80',
    borderWidth: 2.5,
    borderColor: '#5B3FE0',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginRight: 8,
    letterSpacing: -0.3,
  },
  surnameInput: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginRight: 8,
  },
  nameInputEditing: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    paddingBottom: 2,
  },
  editButton: {
    padding: 4,
  },
  settingsContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  settingHint: {
    fontSize: 12,
    color: '#94A3B8',
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 28,
    borderRadius: 16,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  logoutText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});
