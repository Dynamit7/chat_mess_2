import React from 'react';
import { View } from 'react-native';
import Conversations from '../components/Conversations';
import { useTheme } from '../ThemeContext';

export default function ConversationsScreen() {
  const { isDarkMode } = useTheme();

  return (
    <View style={{ backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF', flex: 1 }}>
      <Conversations />
    </View>
  );
}
