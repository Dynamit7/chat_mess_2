import React, { useState, useEffect, useRef } from 'react';
import { refreshAuthToken } from '../src/authFetch';
import { reconnectWithAuth } from '../src/socket';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Platform, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from "../src/config";
import socket from '../src/socket';

// const BASE_URL = Platform.select({ web: 'http://192.168.77.87:3000', default: 'http://192.168.77.87:3000' });

export default function VerifyCodeScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId } = route.params;
  const [code, setCode] = useState('');

  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleVerifyCode = async () => {
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
      const response = await fetch(`${BASE_URL}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Invalid verification code') {
          Alert.alert('Ошибка', 'Неверный код подтверждения. Повторите попытку.');
        } else if (data.error === 'Verification code expired') {
          Alert.alert('Ошибка', 'Срок действия кода истёк. Запросите новый код.');
        } else {
          Alert.alert('Verification Error', data.error || 'Something went wrong');
        }
        return;
      }

      if (data.requiresTwoFactor) {
        navigation.navigate('TwoFactorVerifyScreen', { userId: data.userId });
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
      Alert.alert('Error', 'Cannot verify code at the moment');
    }
  };

  // Используем статические цвета вместо анимированного значения
  // Анимированное значение может вызвать проблемы с expo-linear-gradient
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
        <Text style={styles.title}>Verify Code</Text>
        <Text style={styles.subtitle}>Enter the code sent to your email</Text>

        <View style={styles.inputContainer}>
          <Animatable.View
            animation="slideInLeft"
            duration={1000}
            delay={200}
            style={styles.inputWrapper}
          >
            <TextInput
              placeholder="Verification Code"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={code}
              onChangeText={setCode}
            />
          </Animatable.View>
          <Animated.View style={[styles.button, { transform: [{ scale: buttonScale }] }]}>
            <Animatable.View
              animation="pulse"
              easing="ease-out"
              iterationCount="infinite"
              duration={2000}
            >
              <TouchableOpacity onPress={handleVerifyCode}>
                <LinearGradient
                  colors={['#7C5CFF', '#7C5CFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Confirm</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animatable.View>
          </Animated.View>
        </View>
      </Animatable.View>

      {/* Animated Decorative Particles */}
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    gap: 16,
  },
  inputWrapper: {
    overflow: 'hidden',
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#F5F7FA',
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
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