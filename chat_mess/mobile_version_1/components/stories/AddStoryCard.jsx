import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import Icon from '@expo/vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from "../../src/config";

export default function AddStoryCard({ onStoryAdded, socketRef }) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userData, setUserData] = useState(null);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    (async () => {
      const userId = Platform.OS === 'web'
        ? localStorage.getItem('userId')
        : await AsyncStorage.getItem('userId');
      if (!userId) return;
      setCurrentUserId(userId);
      const res = await fetch(`${BASE_URL}/api/users/${userId}`);
      if (res.ok) setUserData(await res.json());
    })();
  }, []);

  const handlePress = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*,video/*';
        input.onchange = async e => e.target.files[0] && await upload(e.target.files[0]);
        input.click();
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return alert('Media permissions needed');
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsEditing: true, quality: 1 });
        if (result.canceled) return;
        const file = result.assets[0];
        await upload({ uri: file.uri, type: file.type === 'video' ? 'video/mp4' : 'image/jpeg', name: file.fileName || 'story' });
      }
    } catch (err) { console.error(err); }
  };

  const upload = async file => {
    const form = new FormData();
    form.append('userId', currentUserId);
    form.append('file', file, file.name || file.uri.split('/').pop());
    const res = await fetch(`${BASE_URL}/api/stories`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(res.statusText);
    onStoryAdded();
    socketRef?.current?.emit('newStoryCreated', { userId: currentUserId });
  };

  if (!currentUserId) return null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDarkMode ? '#1a1530' : '#fff',
          shadowColor: isDarkMode ? '#7C5CFF' : '#7C5CFF',
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.avatarSection}>
        {/* Gradient ring */}
        <LinearGradient
          colors={['#7C5CFF', '#9070FF', '#FF6B9D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientRing}
        >
          <View style={[styles.avatarInner, { backgroundColor: isDarkMode ? '#1a1530' : '#fff' }]}>
            {userData?.avatar ? (
              <Image style={styles.avatar} source={{ uri: userData.avatar }} />
            ) : (
              <LinearGradient
                colors={['#7C5CFF', '#9070FF']}
                style={styles.avatarPlaceholder}
              >
                <Text style={styles.avatarLetter}>
                  {userData?.username?.[0]?.toUpperCase()}
                </Text>
              </LinearGradient>
            )}
          </View>
        </LinearGradient>

        {/* Plus badge */}
        <LinearGradient
          colors={['#7C5CFF', '#9070FF']}
          style={styles.plusBadge}
        >
          <Icon name="plus" size={10} color="#fff" />
        </LinearGradient>
      </View>

      <View style={styles.textSection}>
        <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#121826' }]}>
          Add a Story
        </Text>
        <Text style={[styles.subtitle, { color: isDarkMode ? '#AD94FF' : '#999' }]}>
          Tap to share a photo or video
        </Text>
      </View>

      <View style={styles.arrowSection}>
        <LinearGradient
          colors={['#7C5CFF22', '#9070FF22']}
          style={styles.arrowCircle}
        >
          <Icon name="chevron-right" size={12} color={isDarkMode ? '#9070FF' : '#7C5CFF'} />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 20,
    elevation: 4,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarSection: {
    position: 'relative',
    marginRight: 14,
  },
  gradientRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  plusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  textSection: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  arrowSection: {
    marginLeft: 8,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
