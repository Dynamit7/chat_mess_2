// AppContainer.jsx
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import socket from './src/socket';

export const navigationRef = React.createRef();

export default function AppContainer() {
  useEffect(() => {
    // Слушаем входящий звонок и переходим на экран IncomingCallScreen
    socket.on('incomingCall', (data) => {
      // data содержит: callerId, callerName, callerPicture
      navigationRef.current?.navigate('IncomingCallScreen', data);
    });
    return () => {
      socket.off('incomingCall');
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  );
}
