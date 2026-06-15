import React, { useState, useRef } from 'react';
import { refreshAuthToken } from '../src/authFetch';
import { reconnectWithAuth } from '../src/socket';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from "../src/config";
import socket from '../src/socket';

export default function TwoFactorVerifyScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId } = route.params;
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleVerify = async () => {
    if (!twoFactorPassword.trim()) {
      Alert.alert('Ошибка', 'Введите пароль двухэтапной аутентификации');
      return;
    }

    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const response = await fetch(`${BASE_URL}/auth/verify-two-factor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, twoFactorPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Invalid two-factor password') {
          Alert.alert('Ошибка', 'Неверный пароль двухэтапной аутентификации');
        } else {
          Alert.alert('Ошибка', data.error || 'Что-то пошло не так');
        }
        return;
      }

      const { token, refreshToken, username } = data;
      await AsyncStorage.setItem('token', token);
      if (refreshToken) await AsyncStorage.setItem('refreshToken', refreshToken);
      refreshAuthToken();   // обновить токен в fetch-перехватчике
      reconnectWithAuth();  // переподключить сокет с токеном
      await AsyncStorage.setItem('username', username);
      await AsyncStorage.setItem('userId', data.userId.toString());

      const userRes = await fetch(`${BASE_URL}/api/users/${data.userId}`);
      const userData = await userRes.json();
      if (userData) {
        await AsyncStorage.setItem('nickname', userData.nickname || '');
        await AsyncStorage.setItem('avatar', userData.avatar || '');
      }

      setTimeout(() => {
        if (socket.connected) {
          socket.emit('registerUser', { userId: Number(data.userId) });
          socket.emit('joinRoom', `user_${data.userId}`);
        }
      }, 500);

      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось проверить пароль');
    }
  };

  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b', '#334155']}
      style={styles.container}
    >
      <StatusBar style="light" />

      <Animatable.View
        animation={{
          from: { scale: 0.8, opacity: 0, translateY: 50 },
          to: { scale: 1, opacity: 1, translateY: 0 },
        }}
        duration={800}
        easing="ease-out-back"
        style={styles.card}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#7C5CFF', '#7C5CFF']}
            style={styles.iconGradient}
          >
            <Ionicons name="shield-checkmark" size={32} color="#fff" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>Двухэтапная аутентификация</Text>
        <Text style={styles.subtitle}>
          Введите пароль, который вы установили для двухэтапной аутентификации
        </Text>

        <View style={styles.inputContainer}>
          <Animatable.View
            animation="slideInLeft"
            duration={1000}
            delay={200}
            style={styles.inputWrapper}
          >
            <View style={styles.passwordRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                placeholder="Пароль"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                secureTextEntry={!passwordVisible}
                value={twoFactorPassword}
                onChangeText={setTwoFactorPassword}
              />
              <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeButton}>
                <Ionicons
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#94a3b8"
                />
              </TouchableOpacity>
            </View>
          </Animatable.View>

          <Animated.View style={[styles.button, { transform: [{ scale: buttonScale }] }]}>
            <TouchableOpacity onPress={handleVerify}>
              <LinearGradient
                colors={['#7C5CFF', '#7C5CFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Подтвердить</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animatable.View>

      <Animatable.View
        animation={{
          from: { rotate: '0deg', translateX: -60, translateY: -60 },
          to: { rotate: '360deg', translateX: -60, translateY: -60 },
        }}
        duration={20000}
        iterationCount="infinite"
        easing="linear"
        style={styles.decorTop}
      >
        <View style={styles.particle} />
      </Animatable.View>
      <Animatable.View
        animation={{
          from: { rotate: '0deg', translateX: 75, translateY: 75 },
          to: { rotate: '-360deg', translateX: 75, translateY: 75 },
        }}
        duration={25000}
        iterationCount="infinite"
        easing="linear"
        style={styles.decorBottom}
      >
        <View style={styles.particle} />
      </Animatable.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  inputContainer: {
    gap: 16,
  },
  inputWrapper: {
    overflow: 'hidden',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5F7FA',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  eyeButton: {
    padding: 4,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  decorTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 120,
    height: 120,
  },
  decorBottom: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 150,
    height: 150,
  },
  particle: {
    width: '100%',
    height: '100%',
    backgroundColor: '#7C5CFF',
    opacity: 0.2,
    borderRadius: 60,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
});
