import React from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import Icon from '@expo/vector-icons/FontAwesome';
import { useTheme } from '../../ThemeContext';

export default function SearchInput() {
  const { isDarkMode } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[
        styles.row,
        {
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F5F7FA',
        }
      ]}>
        <Icon
          name="search"
          size={16}
          color={isDarkMode ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
        />
        <TextInput
          style={[
            styles.input,
            { color: isDarkMode ? '#F5F7FA' : '#1E293B' }
          ]}
          placeholder="Search..."
          placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.35)' : '#94A3B8'}
          maxLength={30}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    borderRadius: 16,
    height: 44,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  input: {
    paddingHorizontal: 12,
    fontSize: 15,
    height: 44,
    flex: 1,
    fontWeight: '400',
  },
});
