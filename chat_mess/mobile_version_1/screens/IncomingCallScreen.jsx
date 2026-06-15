// screens/IncomingCallScreen.jsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Icon from '@expo/vector-icons/FontAwesome';
import socket from '../src/socket';
import { theme } from '../theme';

export default function IncomingCallScreen({ route, navigation }) {
  // Данные, переданные сервером: данные вызывающего
  const { callerId, callerName, callerPicture } = route.params;

  const handleAccept = () => {
    // Уведомляем вызывающего, что звонок принят
    socket.emit('acceptCall', { to: callerId });
    // Заменяем экран входящего звонка на экран видеозвонка
    navigation.replace('OnVideoCallScreen', {
      partnerId: callerId,
      username: callerName,
      picture: callerPicture,
      isCaller: false,
    });
  };

  const handleDecline = () => {
    // Отправляем событие отказа
    socket.emit('declineCall', { to: callerId });
    // Возвращаемся к предыдущему экрану (например, в чат)
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Входящий звонок</Text>
      {callerPicture ? (
        <Image source={{ uri: callerPicture }} style={styles.callerImage} />
      ) : (
        <Icon name="user-circle" size={100} color="#fff" />
      )}
      <Text style={styles.callerName}>{callerName}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleAccept} style={[styles.button, styles.accept]}>
          <Icon name="phone" size={30} color="#fff" />
          <Text style={styles.buttonText}>Принять</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDecline} style={[styles.button, styles.decline]}>
          <Icon name="phone" size={30} color="#fff" />
          <Text style={styles.buttonText}>Отклонить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 20,
  },
  callerImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  callerName: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 40,
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  accept: {
    backgroundColor: 'green',
  },
  decline: {
    backgroundColor: 'red',
  },
  buttonText: {
    color: '#fff',
    marginLeft: 10,
  },
});
