import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import HomeNavigator from '../navigation/HomeNavigator';
import { useTheme } from '../ThemeContext';
import { theme } from '../theme';
import socket from '../src/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';


export default function HomeScreen() {
  const { currentTheme } = useTheme();
  
  useEffect(() => {
    // Регистрируем пользователя как онлайн при монтировании HomeScreen
    // Это важно, так как socket мог подключиться до того, как userId был сохранен
    const registerUserOnline = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          if (socket.connected) {
            socket.emit('registerUser', { userId: Number(userId) });
            socket.emit('joinRoom', `user_${userId}`);
            console.log('User registered as online in HomeScreen:', userId);
          } else {
            // Если socket еще не подключен, ждем подключения
            const onConnect = async () => {
              const currentUserId = await AsyncStorage.getItem('userId');
              if (currentUserId) {
                socket.emit('registerUser', { userId: Number(currentUserId) });
                socket.emit('joinRoom', `user_${currentUserId}`);
                console.log('User registered as online after socket connect in HomeScreen:', currentUserId);
              }
              socket.off('connect', onConnect);
            };
            socket.on('connect', onConnect);
          }
        }
      } catch (error) {
        console.log('Ошибка регистрации пользователя в HomeScreen:', error);
      }
    };

    registerUserOnline();
  }, []);
  
  return (
    <View style={[styles.container, { backgroundColor: '#0B0F19' }]}>
      <HomeNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Replace with your desired background color
  },
});
