import React from 'react'
import { View, Text, StyleSheet } from 'react-native' 

import { theme } from '../theme'
import CustomCamera from '../components/camera/CustomCamera'

export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <CustomCamera />
    </View> 
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black
  }
})