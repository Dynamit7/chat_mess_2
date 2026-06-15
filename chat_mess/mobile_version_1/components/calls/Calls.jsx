import React from 'react'
import { ScrollView } from 'react-native'
import CallItem from './CallItem'

export default function Calls() {
  return (
    <ScrollView>
      <CallItem 
        picture="https://images.pexels.com/photos/28993974/pexels-photo-28993974.jpeg?auto=compress&cs=tinysrgb&w=600&lazy=loadd"
        username="Alica Lope"
        callStatus={0}
        time="12:00 PM Today"
      />

      <CallItem 
        picture="https://images.pexels.com/photos/24531988/pexels-photo-24531988.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
        username="Nina Gomez"
        callStatus={1}
        time="12:00 PM Today"
      />

      <CallItem 
        picture="https://images.pexels.com/photos/28858569/pexels-photo-28858569.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
        username="Alica Smiths"
        callStatus={2}
        time="12:00 PM Today"
      />
    </ScrollView>
  )
}