import { View, Text } from 'react-native'
import React from 'react'

export default function TabBar({ navigationState, setIndex }) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#f0f0f0' }}>
        {navigationState.routes.map((route, i) => (
          <TouchableOpacity key={i} onPress={() => setIndex(i)}>
            <Text style={{ padding: 10, color: i === navigationState.index ? 'blue' : 'gray' }}>
              {route.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }