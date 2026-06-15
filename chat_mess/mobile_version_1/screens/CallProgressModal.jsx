// components/CallProgressModal.jsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme';

export default function CallProgressModal({ visible, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.text}>Идет вызов...</Text>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Отменить вызов</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  container: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center'
  },
  text: {
    marginTop: 10,
    fontSize: 16
  },
  cancelButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: theme.colors.danger,
    borderRadius: 5
  },
  cancelText: {
    color: '#fff'
  }
});
