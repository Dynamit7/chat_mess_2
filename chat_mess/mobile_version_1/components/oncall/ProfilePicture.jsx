import React from 'react'
import { View, Text, StyleSheet, Image } from 'react-native'


export default function ProfilePicture({picture}) {
  return (
    <View>
      <Image style={styles.image} source={{uri: picture}} /> 
    </View>
  )
}

const styles = StyleSheet.create({
    image: {
        height: 200,
        width: 200,
        borderRadius: 100
    }
})