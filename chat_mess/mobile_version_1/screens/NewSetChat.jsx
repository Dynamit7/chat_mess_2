import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const settingsOptions = [
  { id: 1, name: 'Broadcast Lists', icon: 'volume-up' },
  { id: 2, name: 'Starred Messages', icon: 'star' },
  { id: 3, name: 'Linked Devices', icon: 'link' },
  { id: 4, name: 'Account', icon: 'user' },
  { id: 5, name: 'Privacy', icon: 'lock' },
  { id: 6, name: 'Chats', icon: 'wechat' },
  { id: 7, name: 'Notifications', icon: 'bell' },
  { id: 8, name: 'Storage and Data', icon: 'database' },
  { id: 9, name: 'Help', icon: 'info-circle' },
  { id: 10, name: 'Tell a Friend', icon: 'heart' },
];

export default function SettingsScreen() {
  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.optionContainer}>
      <Icon name={item.icon} size={20} color="#4CAF50" style={styles.icon} />
      <Text style={styles.optionText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <FlatList
        data={settingsOptions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
    backgroundColor: '#FFFFFF',
    color: '#333',
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  icon: {
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
});
