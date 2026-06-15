// ChatOptionsModal.jsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ChatOptionsModal({ visible, onClose, onToggleBlock, isBlocked, onClearHistory }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.item} onPress={onToggleBlock}>
            <Text style={styles.text}>{isBlocked ? 'Разблокировать пользователя' : 'Блокировать пользователя'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.item} onPress={onClearHistory}>
            <Text style={styles.text}>Очистить историю</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 20,
  },
  item: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 16,
  },
});
