// screens/OnVideoCallScreen.jsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  mediaDevices,
} from '../src/utils/rtc';
import Icon from '@expo/vector-icons/FontAwesome';
import socket from '../src/socket';
import { theme } from '../theme';

export default function OnVideoCallScreen({ route, navigation }) {
  const { partnerId, username, picture, isCaller } = route.params || {};

  const pc = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  useEffect(() => {
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.current.onaddstream = (event) => {
      console.log('Получен удалённый поток:', event.stream);
      setRemoteStream(event.stream);
    };

    startLocalStream();

    socket.on('offer', handleReceiveOffer);
    socket.on('answer', handleReceiveAnswer);
    socket.on('iceCandidate', handleReceiveCandidate);

    // Добавляем прослушку события завершения вызова от партнёра
    socket.on('callEnded', () => {
      Alert.alert('Вызов завершён', 'Собеседник завершил вызов');
      endCall();
    });

    return () => {
      socket.off('offer', handleReceiveOffer);
      socket.off('answer', handleReceiveAnswer);
      socket.off('iceCandidate', handleReceiveCandidate);
      socket.off('callEnded');
      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!pc.current) return;
    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', {
          to: partnerId,
          candidate: event.candidate,
        });
      }
    };
  }, [partnerId]);

  const startLocalStream = async () => {
    try {
      const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      pc.current.addStream(stream);
      if (isCaller) {
        createOffer();
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Нет доступа к камере/микрофону');
      console.log('startLocalStream error:', e);
    }
  };

  const createOffer = async () => {
    try {
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      socket.emit('offer', { to: partnerId, sdp: offer });
    } catch (e) {
      console.log('createOffer error:', e);
    }
  };

  const handleReceiveOffer = async ({ from, sdp }) => {
    if (from === partnerId && !isCaller) {
      try {
        await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        socket.emit('answer', { to: from, sdp: answer });
      } catch (err) {
        console.log('handleReceiveOffer error:', err);
      }
    }
  };

  const handleReceiveAnswer = async ({ from, sdp }) => {
    if (from === partnerId && isCaller) {
      try {
        await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.log('handleReceiveAnswer error:', err);
      }
    }
  };

  const handleReceiveCandidate = async ({ from, candidate }) => {
    if (from === partnerId && candidate) {
      try {
        await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.log('handleReceiveCandidate error:', err);
      }
    }
  };

  const endCall = () => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    // Если локальный пользователь завершает вызов, отправляем уведомление партнёру
    socket.emit('endCall', { to: partnerId });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Видео-звонок с {username}</Text>
      {localStream && <RTCView streamURL={localStream} style={styles.video} />}
      {remoteStream ? (
        <RTCView streamURL={remoteStream} style={styles.video} />
      ) : (
        <Text style={styles.waitingText}>Ожидание подключения собеседника...</Text>
      )}
      <View style={styles.footer}>
        <TouchableOpacity onPress={endCall} style={styles.endCallButton}>
          <Icon name="phone" size={25} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primary, paddingTop: 50 },
  header: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 10 },
  video: { flex: 1, margin: 5 },
  waitingText: { textAlign: 'center', color: '#fff', fontSize: 16, marginVertical: 10 },
  footer: { alignItems: 'center', marginBottom: 30 },
  endCallButton: { backgroundColor: theme.colors.danger, padding: 15, borderRadius: 50 },
});
