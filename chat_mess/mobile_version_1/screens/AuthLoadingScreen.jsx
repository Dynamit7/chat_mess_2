import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import socket from '../src/socket';

export default function AuthLoadingScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          // Регистрируем пользователя как онлайн перед навигацией на Home
          const userId = await AsyncStorage.getItem('userId');
          if (userId && socket.connected) {
            socket.emit('registerUser', { userId: Number(userId) });
            socket.emit('joinRoom', `user_${userId}`);
            console.log('User registered as online in AuthLoadingScreen:', userId);
          }
          
          // Если токен есть — отправляем на Home (или другой основной экран)
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        } else {
          // Если нет — на Login
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
      } catch (err) {
        console.log('Ошибка проверки токена:', err);
        // На случай ошибки тоже можно отправлять на Login
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    };

    checkToken();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#0000ff" />
    </View>
  );
}
