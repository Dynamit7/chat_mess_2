import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { useTheme } from '../../ThemeContext';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/FontAwesome5';
import DefensyLogo from './DefensyLogo';
import emitter from '../../screens/eventEmitter';
import { BASE_URL } from '../../src/config';

export default function Header({ title, navigation }) {
  const [fontsLoaded] = useFonts({ Orbitron_700Bold });
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const { t, i18n } = useTranslation();
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showGhostMessage, setShowGhostMessage] = useState(false);
  const { isDarkMode } = useTheme();
  const [username, setUsername] = useState(null);
  const [userAvatar, setUserAvatar] = useState(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const loadLanguage = async () => {
      const savedLanguage = await AsyncStorage.getItem('language');
      if (savedLanguage) {
        i18n.changeLanguage(savedLanguage);
      }
    };
    loadLanguage();
  }, []);

  useEffect(() => {
    const loadGhostMode = async () => {
      try {
        const storedGhost = await AsyncStorage.getItem('ghostMode');
        if (storedGhost !== null) {
          setGhostMode(JSON.parse(storedGhost));
        }
      } catch (err) {
        console.error("Error reading ghostMode:", err);
      }
    };
    loadGhostMode();
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          const response = await fetch(`${BASE_URL}/api/users/${userId}`);
          if (response.ok) {
            const userData = await response.json();
            setUsername(userData.username || 'User');
            setUserAvatar(userData.avatar || null);
          }
        }
      } catch (err) {
        console.error("Error loading user data:", err);
        setUsername('User');
      }
    };
    loadUserData();

    const handleAvatarUpdate = (newAvatarUrl) => {
      setUserAvatar(newAvatarUrl);
    };
    emitter.on('avatarUpdated', handleAvatarUpdate);

    return () => {
      emitter.off('avatarUpdated', handleAvatarUpdate);
    };
  }, []);

  const fetchWeather = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        'https://api.openweathermap.org/data/2.5/weather?q=Tashkent,uz&appid=ac43652720e72e55c992e9a142c0e415&units=metric'
      );
      const data = await response.json();
      setWeatherData({
        temperature: data.main.temp,
        description: data.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`,
        city: data.name,
        country: data.sys.country,
        windSpeed: data.wind.speed,
        humidity: data.main.humidity,
      });
    } catch (error) {
      console.error('Error fetching weather:', error);
    } finally {
      setLoading(false);
      setModalVisible(true);
    }
  };

  useEffect(() => {
    if (showGhostMessage) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowGhostMessage(false));
        }, 2000);
      });
    }
  }, [showGhostMessage]);

  const toggleGhostMode = async () => {
    const newMode = !ghostMode;
    setGhostMode(newMode);
    setShowGhostMessage(true);

    try {
      await AsyncStorage.setItem('ghostMode', JSON.stringify(newMode));
      const userId = await AsyncStorage.getItem('userId');
      await fetch(`${BASE_URL}/api/users/updateGhostMode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ghostMode: newMode }),
      });
    } catch (err) {
      console.error("Error saving ghostMode:", err);
    }
  };

  return (
    <LinearGradient
      colors={isDarkMode
        ? ['#0B0F19', '#1A2233', '#0B0F19']
        : ['#5B3FE0', '#7C5CFF', '#7C5CFF']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <View style={styles.headerContainer}>
        <View style={styles.titleRow}>
          <DefensyLogo size={22} />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={fetchWeather} style={styles.iconButton}>
            <View style={styles.iconCircle}>
              <Icon name="cloud-sun" size={16} color="rgba(255,255,255,0.9)" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleGhostMode} style={styles.iconButton}>
            <View style={[styles.iconCircle, ghostMode && styles.iconCircleActive]}>
              <Icon name="ghost" size={16} color={ghostMode ? '#4ADE80' : 'rgba(255,255,255,0.9)'} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ProfScren2')} style={styles.avatarButton}>
            {userAvatar ? (
              <Image source={{ uri: userAvatar }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#00C2FF', '#7C5CFF']}
                style={[styles.avatar, styles.letterContainer]}
              >
                <Text style={styles.letter}>
                  {username?.[0]?.toUpperCase() || "?"}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.weatherCard}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.weatherGradient}
            >
              {loading ? (
                <ActivityIndicator size="large" color="white" />
              ) : weatherData ? (
                <>
                  <Text style={styles.cityText}>{`${weatherData.city}, ${weatherData.country}`}</Text>
                  <View style={styles.weatherIconRow}>
                    <Icon name="cloud-sun" size={48} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={styles.temperatureText}>{`${Math.round(weatherData.temperature)}°`}</Text>
                  <Text style={styles.descriptionText}>
                    {weatherData.description.charAt(0).toUpperCase() + weatherData.description.slice(1)}
                  </Text>
                  <View style={styles.detailsContainer}>
                    <View style={styles.detailItem}>
                      <Icon name="tint" size={14} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.detailText}>{`${weatherData.humidity}%`}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Icon name="wind" size={14} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.detailText}>{`${weatherData.windSpeed} m/s`}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.errorText}>{t('error')}</Text>
              )}
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>{t('close')}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {showGhostMessage && (
        <Animated.View style={[styles.ghostModeContainer, { opacity: fadeAnim }]}>
          <View style={styles.ghostPill}>
            <Icon name="ghost" size={14} color={ghostMode ? '#4ADE80' : '#EF4444'} style={{ marginRight: 8 }} />
            <Text style={styles.ghostModeText}>
              {ghostMode ? 'Ghost mode ON' : 'Ghost mode OFF'}
            </Text>
          </View>
        </Animated.View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 48,
    paddingBottom: 14,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 4,
    textShadowColor: 'rgba(196, 181, 253, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  titleDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
    marginLeft: 5,
    marginTop: -10,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    padding: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(74, 222, 128, 0.4)',
  },
  avatarButton: {
    marginLeft: 4,
  },
  avatar: {
    height: 36,
    width: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  letterContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  letter: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherCard: {
    width: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  weatherGradient: {
    padding: 28,
    alignItems: 'center',
  },
  weatherIconRow: {
    marginVertical: 16,
  },
  cityText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  temperatureText: {
    fontSize: 64,
    fontWeight: '200',
    color: 'white',
    letterSpacing: -2,
  },
  descriptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  detailsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  errorText: {
    fontSize: 16,
    color: 'white',
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  ghostModeContainer: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
  },
  ghostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  ghostModeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});
