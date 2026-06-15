import React from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Channel from './ChannelsListScreen';
import { useTheme } from '../ThemeContext';
import Icon from '@expo/vector-icons/FontAwesome';
import { theme } from '../theme';
import { fabStyles } from '../styles';

/**
 * Экран, который показывает список сторис (компонент <Stories/>).
 * Внизу плавающая кнопка камеры (можно сделать тот же функционал, что и в AddStoryCard).
 */
export default function StoriesScreen() {
  const { isDarkMode } = useTheme();

  const handleCameraPress = () => {
    console.log('Camera FAB pressed');
    // Здесь по желанию можно открыть камеру или галерею
    // аналогично тому, что делается в <AddStoryCard />
  };

  return (
    <View style={{ backgroundColor: isDarkMode ? '#1C1C1C' : '#fff', flex: 1 }}>
      <ScrollView>
        <Channel />
      </ScrollView>

      <TouchableOpacity style={fabStyles.style} onPress={handleCameraPress}>
        <Icon name="camera" size={25} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
