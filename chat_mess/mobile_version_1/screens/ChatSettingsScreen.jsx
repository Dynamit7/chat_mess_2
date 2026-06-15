import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';

const ChatSettingsScreen = () => {
  const [fontSize, setFontSize] = useState(16);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState(null);

  const navigation = useNavigation();
  const { isDarkMode } = useTheme();

  const backgrounds = [
    { type: 'gradient', value: ['#ff7e5f', '#feb47b'] },
    { type: 'gradient', value: ['#00c6ff', '#0072ff'] },
    { type: 'gradient', value: ['#6a11cb', '#2575fc'] },
    { type: 'gradient', value: ['#acb6e5', '#86fde8'] },
    { type: 'image', value: 'https://img.freepik.com/free-vector/messages-light-colour-background_78370-2586.jpg?ga=GA1.1.1343514240.1733401089&semt=ais_hybrid' },
    { type: 'image', value: 'https://img.freepik.com/free-vector/dialogue-chat-clouds-speech-bubble-icon-from-lines-triangles-particle-style-design-low-poly-technology-devices-people-communication-concept-blue-background_587448-472.jpg?ga=GA1.1.1343514240.1733401089&semt=ais_hybrid' },
    { type: 'image', value: 'https://img.freepik.com/free-vector/vector-social-contact-seamless-pattern-white-blue_1284-41919.jpg?ga=GA1.1.1343514240.1733401089&semt=ais_hybrid' },
  ];

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedFontSize = await AsyncStorage.getItem('fontSize');
        const storedTheme = await AsyncStorage.getItem('isDarkTheme');
        const storedBackground = await AsyncStorage.getItem('selectedBackground');

        if (storedFontSize !== null) setFontSize(Number(storedFontSize));
        if (storedTheme !== null) setIsDarkTheme(JSON.parse(storedTheme));
        if (storedBackground !== null) setSelectedBackground(JSON.parse(storedBackground));
      } catch (error) {
        console.error('Error loading settings', error);
      }
    };

    loadSettings();
  }, []);

  const applyBackground = (item) => {
    setSelectedBackground(item);
  };

  const resetToDefault = async () => {
    setSelectedBackground(null);
    await AsyncStorage.setItem('selectedBackground', JSON.stringify(null));
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('fontSize', fontSize.toString());
      await AsyncStorage.setItem('isDarkTheme', JSON.stringify(isDarkTheme));
      await AsyncStorage.setItem('selectedBackground', JSON.stringify(selectedBackground));
    } catch (error) {
      console.error('Error saving settings', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0B0F19' : '#FAFBFE' }]}>
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F5F7FA' }]}
        onPress={() => navigation.goBack()}
      >
        <Icon name="arrow-left" size={22} color={isDarkMode ? '#F5F7FA' : '#1E293B'} />
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={[styles.label, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
          Font Size
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={12}
          maximumValue={24}
          step={1}
          value={fontSize}
          onValueChange={(value) => setFontSize(value)}
          minimumTrackTintColor="#7C5CFF"
          maximumTrackTintColor={isDarkMode ? 'rgba(255,255,255,0.15)' : '#F5F7FA'}
          thumbTintColor="#7C5CFF"
        />
        <Text style={[styles.fontSizeDisplay, { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
          {fontSize}px
        </Text>
      </View>

      <View style={[styles.chatPreview, { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#F5F7FA' }]}>
        {selectedBackground?.type === 'gradient' ? (
          <LinearGradient
            colors={Array.isArray(selectedBackground.value) && selectedBackground.value.every(c => typeof c === 'string' && c)
              ? selectedBackground.value
              : ['#4facfe', '#00f2fe']}
            style={styles.chatBackground}
          >
            <View style={styles.messageContainer}>
              <Text style={[styles.chatTextSender, { fontSize }]}>Good morning! </Text>
            </View>
            <View style={styles.messageContainer}>
              <Text style={[styles.chatTextReceiver, { fontSize }]}>Do you know what time it is?</Text>
            </View>
          </LinearGradient>
        ) : selectedBackground?.type === 'image' ? (
          <ImageBackground source={{ uri: selectedBackground.value }} style={styles.chatBackground}>
            <View style={styles.messageContainer}>
              <Text style={[styles.chatTextSender, { fontSize }]}>Good morning! </Text>
            </View>
            <View style={styles.messageContainer}>
              <Text style={[styles.chatTextReceiver, { fontSize }]}>Do you know what time it is?</Text>
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.chatBackground, { backgroundColor: isDarkMode ? '#0B0F19' : '#FAFBFE' }]}>
            <View style={styles.messageContainer}>
              <Text style={[styles.chatTextSender, { fontSize, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F5F7FA', color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
                Good morning!
              </Text>
            </View>
            <View style={styles.messageContainer}>
              <Text style={[styles.chatTextReceiver, { fontSize }]}>Do you know what time it is?</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>
          Choose Background
        </Text>
        <FlatList
          horizontal
          data={backgrounds}
          keyExtractor={(item, index) => `background-${index}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.backgroundItem}
              onPress={() => applyBackground(item)}
            >
              {item.type === 'gradient' ? (
                <LinearGradient
                  colors={Array.isArray(item.value) && item.value.every(c => typeof c === 'string' && c)
                    ? item.value
                    : ['#4facfe', '#00f2fe']}
                  style={styles.backgroundPreview}
                />
              ) : (
                <ImageBackground
                  source={{ uri: item.value }}
                  style={styles.backgroundPreview}
                />
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      <TouchableOpacity style={styles.applyButton} onPress={saveSettings}>
        <LinearGradient colors={['#7C5CFF', '#5B3FE0']} style={styles.buttonGradient}>
          <Text style={styles.applyButtonText}>Apply</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.resetButton} onPress={resetToDefault}>
        <Text style={[styles.resetButtonText, { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
          Reset to Default
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    width: 42,
    height: 42,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  slider: {
    width: '100%',
    height: 30,
  },
  fontSizeDisplay: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  chatPreview: {
    flex: 0.8,
    borderRadius: 16,
    marginBottom: 16,
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  chatBackground: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  messageContainer: {
    marginBottom: 10,
  },
  chatTextSender: {
    color: '#1E293B',
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 6,
    backgroundColor: '#F5F7FA',
    fontWeight: '400',
  },
  chatTextReceiver: {
    color: '#fff',
    alignSelf: 'flex-end',
    padding: 10,
    borderRadius: 16,
    borderBottomRightRadius: 6,
    backgroundColor: '#7C5CFF',
    fontWeight: '400',
  },
  backgroundItem: {
    marginRight: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  backgroundPreview: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  applyButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resetButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ChatSettingsScreen;
