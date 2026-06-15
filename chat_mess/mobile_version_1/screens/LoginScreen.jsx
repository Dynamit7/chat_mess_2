import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Animated, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { BASE_URL } from "../src/config";
import DefensyLogo from '../components/common/DefensyLogo';

export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Ошибка', 'Введите email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Ошибка', 'Введите пароль');
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

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Ошибка входа', data.error || 'Что-то пошло не так');
        return;
      }

      await AsyncStorage.setItem('userId', data.userId.toString());
      navigation.navigate('VerifyCodeScreen', { userId: data.userId });
    } catch (err) {
      console.log('Error while logging in:', err);
      Alert.alert('Ошибка', 'Не удалось войти. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0f0524', '#1a0a3e', '#2d1b69']}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Decorative orbs */}
      <View style={styles.orbContainer}>
        <Animatable.View
          animation={{
            0: { opacity: 0.3, scale: 1 },
            0.5: { opacity: 0.5, scale: 1.1 },
            1: { opacity: 0.3, scale: 1 },
          }}
          duration={4000}
          iterationCount="infinite"
          style={[styles.orb, styles.orbPurple]}
        />
        <Animatable.View
          animation={{
            0: { opacity: 0.2, scale: 1 },
            0.5: { opacity: 0.4, scale: 1.15 },
            1: { opacity: 0.2, scale: 1 },
          }}
          duration={5000}
          iterationCount="infinite"
          style={[styles.orb, styles.orbPink]}
        />
      </View>

      <Animatable.View
        animation={{
          from: { opacity: 0, translateY: 30 },
          to: { opacity: 1, translateY: 0 },
        }}
        duration={700}
        easing="ease-out-quart"
        style={styles.card}
      >
        {/* App icon */}
        <View style={styles.iconWrapper}>
          <LinearGradient
            colors={['#7C5CFF', '#00C2FF']}
            style={styles.iconGradient}
          >
            <Icon name="shield-lock" size={28} color="#fff" />
          </LinearGradient>
        </View>

        <DefensyLogo size={36} style={{ alignSelf: 'center', marginBottom: 18 }} />

        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.inputContainer}>
          <Animatable.View animation="fadeInUp" duration={600} delay={100}>
            <View style={styles.inputWrapper}>
              <Icon name="email-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                placeholder="Email"
                placeholderTextColor="#6B7280"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={600} delay={200}>
            <View style={styles.inputWrapper}>
              <Icon name="lock-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                placeholderTextColor="#6B7280"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={600} delay={300}>
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
                <LinearGradient
                  colors={['#5B3FE0', '#7C5CFF', '#7C5CFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Sign In</Text>
                      <Icon name="arrow-right" size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animatable.View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.push('SignUp')}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </Animatable.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbPurple: {
    width: 200,
    height: 200,
    backgroundColor: '#5B3FE0',
    top: '10%',
    left: '-15%',
    opacity: 0.3,
  },
  orbPink: {
    width: 180,
    height: 180,
    backgroundColor: '#00C2FF',
    bottom: '15%',
    right: '-10%',
    opacity: 0.2,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconWrapper: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    gap: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 15,
    color: '#FFFFFF',
  },
  eyeButton: {
    padding: 4,
  },
  buttonGradient: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  footerLink: {
    fontSize: 14,
    color: '#7C5CFF',
    fontWeight: '600',
  },
});
