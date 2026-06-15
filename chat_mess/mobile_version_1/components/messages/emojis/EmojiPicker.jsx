import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';

const emojiList = ['😀', '😂', '😍', '😭', '😎', '👍', '🎉', '🔥', '❤️', '🙏'];

export default function EmojiPicker({ visible, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalBackground}>
        <View style={styles.emojiContainer}>
          <Text style={styles.headerText}>Pick an Emoji</Text>
          <FlatList
            data={emojiList}
            keyExtractor={(item, index) => index.toString()}
            numColumns={5}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.emojiButton} onPress={() => onSelect(item)}>
                <Text style={styles.emoji}>{item}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  emojiContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emojiButton: {
    padding: 10,
    margin: 5,
  },
  emoji: {
    fontSize: 24,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});



// import React, { useState, memo } from 'react'
// import { View, Text, useWindowDimensions } from 'react-native'
// import { TabView } from 'react-native-tab-view'

// import categories from '../../../data/categories';
// import EmojiCategory from './EmojiCategory';
// import TabBar from './TabBar';

// const EmojiPicker = () => {
//     const layout = useWindowDimensions();
//     const [index, setIndex] = useState(0);
//     const [routes, setRoutes] = useState(categories.tabs.map(tab => ({key: tab.category, title: tab.tabLabel})));
    
//     const renderScene = ({route}) => (
//         <EmojiCategory
//             category={route.key}

//         />
//     )

//   return (
//     <TabView 
//         renderTabBar={props => <TabBar setIndex={setIndex} {...props} />}
//         navigationState={{index, routes}}
//         onIndexChange={setIndex}
//         renderScene={renderScene}
//         initialLayout={{width: layout.width}}
//     />
//   )
// }   

// export default memo(EmojiPicker)