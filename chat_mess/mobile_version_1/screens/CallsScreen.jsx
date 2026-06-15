import React from 'react'
import { View, ScrollView, TouchableOpacity } from 'react-native'
import Icon from '@expo/vector-icons/FontAwesome5'
import Calls from '../components/calls/Calls';
import { theme } from '../theme';
import { fabStyles } from '../styles';

import { useTheme } from '../ThemeContext';

export default function CallsScreen() {
  const { isDarkMode } = useTheme(); 
  return (
    <View style={{flex: 1,  backgroundColor: isDarkMode ? '#1C1C1C' : theme.colors.white}}>
      <ScrollView>
        <Calls />
      </ScrollView>
      <TouchableOpacity style={fabStyles.style}>
        <Icon name="phone" size={25} color={theme.colors.primary}/>
      </TouchableOpacity>
    </View>
  )
}