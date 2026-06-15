// components/ChatInput.jsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Text,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { BASE_URL } from "../../src/config";
import socket from '../../src/socket';
import EmojiKeyboard from '../EmojiKeyboard';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

export default function ChatInput({
  reply,
  closeReply,
  isLeft,
  username,
  onSend,
  editingMessage,
  currentUserId,
  partnerId,
  onEmojiVisibilityChange,
  onVideoCirclePress,
}) {
  const [message, setMessage] = useState('');
  const [isEmojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);

  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const updateEmojiVisibility = (visible) => {
    setEmojiPickerVisible(visible);
    onEmojiVisibilityChange?.(visible);
  };

  // Отслеживаем высоту клавиатуры для динамического отступа
  useEffect(() => {
    if (Platform.OS === 'android') {
      const keyboardWillShow = Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      const keyboardWillHide = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });

      return () => {
        keyboardWillShow.remove();
        keyboardWillHide.remove();
      };
    }
  }, []);

  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.text || '');
      setIsEditing(true);
      setEditingMessageId(editingMessage.id);
    }
  }, [editingMessage]);

  // Переменная для хранения таймаута печатания
  const typingTimeoutRef = useRef(null);

  // Функция для обработки изменения текста с отправкой события "печатает" через Redis
  const handleTextChange = (text) => {
    setMessage(text);
    
    if (!currentUserId || !partnerId) return;
    
    const chatId = `${Math.min(currentUserId, partnerId)}_${Math.max(currentUserId, partnerId)}`;
    
    // Отправляем событие "печатает" через Redis
    if (text.length > 0) {
      socket.emit("typing", {
        userId: currentUserId,
        chatId: chatId,
        isTyping: true
      });
      
      // Сбрасываем предыдущий таймаут
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Устанавливаем новый таймаут для остановки "печатает" через 2 секунды
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", {
          userId: currentUserId,
          chatId: chatId,
          isTyping: false
        });
        typingTimeoutRef.current = null;
      }, 2000);
    } else {
      // Если текст пустой, отправляем остановку
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      socket.emit("typing", {
        userId: currentUserId,
        chatId: chatId,
        isTyping: false
      });
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // При размонтировании отправляем остановку печатания
      if (currentUserId && partnerId) {
        const chatId = `${Math.min(currentUserId, partnerId)}_${Math.max(currentUserId, partnerId)}`;
        socket.emit("typing", {
          userId: currentUserId,
          chatId: chatId,
          isTyping: false
        });
      }
    };
  }, [currentUserId, partnerId]);

  const startVoiceRecordingMobile = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Микрофон', 'Для записи голосового сообщения нужно разрешение на микрофон.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Ошибка при запуске записи:', error);
    }
  };

  const stopVoiceRecordingMobile = async () => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setIsRecording(false);
      setRecording(null);
      const fileUrl = await uploadFile(uri, 'audio/mp4');
      onSend({ type: 'voice', fileUrl });
    } catch (error) {
      console.error('Ошибка при остановке записи:', error);
    }
  };

  const startVoiceRecordingWeb = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        Alert.alert('Ошибка', 'Ваш браузер не поддерживает запись аудио.');
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === 'audioinput');

      if (!audioInputs.length) {
        Alert.alert('Микрофон', 'Микрофон не найден. Подключите устройство ввода и попробуйте снова.');
        return;
      }

      const preferredDeviceId = audioInputs[0]?.deviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mediaRecorder = new MediaRecorder(stream);
      let chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const uploadedUrl = await uploadFile(URL.createObjectURL(blob), 'audio/webm');
        if (uploadedUrl) {
          onSend({ type: 'voice', fileUrl: uploadedUrl });
        } else {
          Alert.alert('Ошибка', 'Не удалось загрузить голосовое сообщение. Попробуйте снова.');
        }
      };

      mediaRecorder.start();
      setRecording(mediaRecorder);
      setIsRecording(true);
    } catch (error) {
      if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        Alert.alert('Микрофон', 'Не удалось найти доступный микрофон. Проверьте настройки устройства.');
      } else if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        Alert.alert('Микрофон', 'Нет доступа к микрофону. Разрешите использование микрофона в браузере.');
      }
      console.error('Ошибка при записи на веб:', error);
    }
  };

  const stopVoiceRecordingWeb = async () => {
    if (recording) {
      recording.stop();
      setIsRecording(false);
      setRecording(null);
    }
  };

  const startVoiceRecording = async () => {
    if (Platform.OS === 'web') {
      await startVoiceRecordingWeb();
    } else {
      await startVoiceRecordingMobile();
    }
  };

  const stopVoiceRecording = async () => {
    if (Platform.OS === 'web') {
      await stopVoiceRecordingWeb();
    } else {
      await stopVoiceRecordingMobile();
    }
  };

  const handleSendPress = () => {
    if (!message.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Отправляем событие остановки печатания перед отправкой сообщения
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    const chatId = `${Math.min(currentUserId, partnerId)}_${Math.max(currentUserId, partnerId)}`;
    socket.emit("typing", {
      userId: currentUserId,
      chatId: chatId,
      isTyping: false
    });

    if (isEditing && editingMessageId) {
      onSend({
        type: 'edit',
        messageId: editingMessageId,
        text: message.trim(),
      });
      setIsEditing(false);
      setEditingMessageId(null);
    } else {
      onSend({
        type: 'text',
        text: message.trim(),
        replyToId: reply ? reply.id : null,
      });
      closeReply();
    }
    setMessage('');
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingMessageId(null);
    setMessage('');
  };

  const uploadFile = async (uri, mimeType, filename) => {
    setUploading(true);
    try {
      const formData = new FormData();
      const fileName = filename || uri.split('/').pop();

      if (Platform.OS !== 'web') {
        formData.append('file', {
          uri,
          name: fileName,
          type: mimeType,
        });
      } else {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      }

      const response = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      return data.url;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const fileUrl = await uploadFile(URL.createObjectURL(file), file.type, file.name);
          if (fileUrl) {
            onSend({ type: 'image', fileUrl });
          }
        }
      };
      input.click();
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Галерея', 'Нужно разрешение на доступ к галерее');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUrl = await uploadFile(result.assets[0].uri, 'image/jpeg');
        if (fileUrl) {
          onSend({ type: 'image', fileUrl });
        }
      }
    }
  };

  const pickVideo = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const fileUrl = await uploadFile(URL.createObjectURL(file), file.type, file.name);
          if (fileUrl) {
            onSend({ type: 'video', fileUrl });
          }
        }
      };
      input.click();
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Галерея', 'Нужно разрешение на доступ к галерее для видео.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileUrl = await uploadFile(result.assets[0].uri, 'video/mp4');
        if (fileUrl) {
          onSend({ type: 'video', fileUrl });
        }
      }
    }
  };

  const pickFile = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const fileUrl = await uploadFile(URL.createObjectURL(file), file.type, file.name);
          if (fileUrl) {
            onSend({ type: 'file', fileUrl, filename: file.name });
          }
        }
      };
      input.click();
    } else {
      const result = await DocumentPicker.getDocumentAsync({});
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileUrl = await uploadFile(asset.uri, asset.mimeType, asset.name);
        if (fileUrl) {
          onSend({ type: 'file', fileUrl, filename: asset.name });
        }
      }
    }
  };

  const sendLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Геолокация', 'Нужно разрешение на доступ к геолокации.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onSend({
        type: 'location',
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось получить местоположение.');
    }
  };

  const handleEmojiSelect = (emoji) => {
    const newText = message + emoji;
    handleTextChange(newText);
  };

  return (
  <View style={{ flexShrink: 0 }}>
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#0B0F19' : '#FAFBFE',
          paddingBottom: isEmojiPickerVisible ? 0 : (Platform.OS === 'android'
            ? (insets.bottom || 0) + (keyboardHeight > 0 ? 12 : 0)
            : insets.bottom || 0),
        },
      ]}
    >
      {isEditing && (
        <View style={styles.editingContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>Редактирование сообщения</Text>
            <TouchableOpacity onPress={cancelEditing} style={styles.closeReplyButton}>
              <Icon name="close" size={20} color={isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B'} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {reply && !isEditing && (
        <View style={styles.replyContainer}>
          <View style={styles.replyBorder} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>
              Ответ на {isLeft ? username : 'Себя'}
            </Text>
            <TouchableOpacity onPress={closeReply} style={styles.closeReplyButton}>
              <Icon name="close" size={20} color={isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B'} />
            </TouchableOpacity>
          </View>
          <Text style={styles.reply} numberOfLines={2}>
            {reply.text}
          </Text>
        </View>
      )}

      <View style={styles.innerContainer}>
        <View style={[
          styles.inputAndMicrophone,
          isDarkMode && { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)' }
        ]}>
          <TouchableOpacity
            style={styles.emoticonButton}
            onPress={() => {
              if (isEmojiPickerVisible) {
                updateEmojiVisibility(false);
              } else {
                Keyboard.dismiss();
                setTimeout(() => updateEmojiVisibility(true), 200);
              }
            }}
          >
            <Icon name="emoticon-outline" size={23} color={isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B'} />
          </TouchableOpacity>
          <TextInput
            multiline
            placeholder={isEditing ? 'Редактировать сообщение...' : 'Напишите сообщение...'}
            placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
            style={[styles.input, isDarkMode && { color: '#F5F7FA' }]}
            onChangeText={handleTextChange}
            value={message}
            onFocus={() => updateEmojiVisibility(false)}
          />
          {!isEditing && (
            <TouchableOpacity
              style={styles.rightIconButtonStyle}
              onPress={() => {
                Keyboard.dismiss();
                setAttachMenuVisible(true);
              }}
            >
              <Icon name="plus-circle-outline" size={25} color={isDarkMode ? 'rgba(255,255,255,0.55)' : '#64748B'} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={async () => {
            if (message.trim()) {
              handleSendPress();
            } else {
              if (isRecording) {
                await stopVoiceRecording();
              } else {
                await startVoiceRecording();
              }
            }
          }}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Icon
              name={
                message.trim()
                  ? 'send'
                  : isRecording
                  ? 'stop-circle'
                  : 'microphone'
              }
              size={23}
              color="#FFFFFF"
            />
          )}
        </TouchableOpacity>
      </View>

    </View>
    {isEmojiPickerVisible && (
      <EmojiKeyboard onEmojiSelect={handleEmojiSelect} onClose={() => updateEmojiVisibility(false)} height={280} />
    )}

    <Modal
      visible={attachMenuVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setAttachMenuVisible(false)}
    >
      <TouchableOpacity
        style={styles.attachBackdrop}
        activeOpacity={1}
        onPress={() => setAttachMenuVisible(false)}
      >
        <View style={[
          styles.attachSheet,
          { backgroundColor: isDarkMode ? '#121826' : '#FFFFFF' },
        ]}>
          <View style={styles.attachHandle} />
          <View style={styles.attachGrid}>
            {[
              { icon: 'image', label: 'Фото', color: '#7C5CFF', onPress: pickImage },
              { icon: 'video', label: 'Видео', color: '#00C2FF', onPress: pickVideo },
              { icon: 'paperclip', label: 'Файл', color: '#22C55E', onPress: pickFile },
              { icon: 'map-marker', label: 'Локация', color: '#EF4444', onPress: sendLocation },
              ...(onVideoCirclePress ? [{ icon: 'circle-slice-8', label: 'Кружок', color: '#F59E0B', onPress: onVideoCirclePress }] : []),
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.attachItem}
                activeOpacity={0.7}
                onPress={() => {
                  setAttachMenuVisible(false);
                  setTimeout(() => item.onPress && item.onPress(), 250);
                }}
              >
                <View style={[styles.attachIconCircle, { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}>
                  <Icon name={item.icon} size={26} color={item.color} />
                </View>
                <Text style={[styles.attachLabel, { color: isDarkMode ? '#F5F7FA' : '#1E293B' }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  replyContainer: {
    paddingHorizontal: 14,
    marginHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: 'rgba(124, 92, 255, 0.08)',
    borderRadius: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7C5CFF',
  },
  replyBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#7C5CFF',
  },
  editingContainer: {
    paddingHorizontal: 14,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(124, 92, 255, 0.08)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  title: {
    marginTop: 2,
    fontWeight: '600',
    color: '#7C5CFF',
    fontSize: 13,
  },
  closeReplyButton: {
    padding: 5,
    marginLeft: 10,
  },
  reply: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '400',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputAndMicrophone: {
    flexDirection: 'row',
    backgroundColor: '#F5F7FA',
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    paddingHorizontal: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F5F7FA',
  },
  input: {
    paddingLeft: 10,
    flex: 1,
    fontSize: 15,
    height: 46,
    textAlignVertical: 'center',
    includeFontPadding: false,
    color: '#1E293B',
  },
  emoticonButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  rightIconButtonStyle: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    padding: 2,
  },
  attachBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  attachHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,0.4)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  attachGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 18,
  },
  attachItem: {
    alignItems: 'center',
    width: 76,
  },
  attachIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  attachLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#7C5CFF',
    borderRadius: 23,
    height: 46,
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emoji: {
    fontSize: 24,
  },
});
