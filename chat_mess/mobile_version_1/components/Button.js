import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcon } from '@expo/vector-icons';

export default function Button({icon, size, color, style, onPress}) {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
        <MaterialIcon 
            name={icon}
            size = {size ? size : 28}
            color={color ? color : "#f1f1f1"}
        />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
    button:{
        height: 40,
        alignItems: 'center',
        justifyContent: 'center'
    }
})