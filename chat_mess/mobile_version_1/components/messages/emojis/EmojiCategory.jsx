import React, { memo } from 'react'
import { FlatList, StyleSheet, Dimensions } from 'react-native'
import Emoji from './Emoji'
import { emojisByCategory } from '../../../data/emojis'



const EmojiCategory = ({category}) => {
  return (
    <FlatList 
        style={styles.container}
        data={emojisByCategory[category]}
        renderItem={({item}) => <Emoji item = {item}/>}
        keyExtractor={(item) => item}
        numColumns={8}
    />
  )
}


const styles = StyleSheet.create({
    container: {
        flex: 1
    }
})

export default memo(EmojiCategory)