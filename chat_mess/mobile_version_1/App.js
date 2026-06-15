import './src/authFetch'; // ОДИН раз подменяет global.fetch, чтобы добавлять JWT ко всем запросам к API
import { StatusBar } from 'expo-status-bar'
import React, { useEffect } from 'react';
import { StyleSheet, Platform, Alert, View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './ThemeContext'
import i18n from './i18n';
import { I18nextProvider } from 'react-i18next';
import { LanguageProvider } from './LanguageContext';
import AppContainer from './AppContainer';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import socket from './src/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Raleway_100Thin,
  Raleway_200ExtraLight,
  Raleway_300Light,
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_600SemiBold,
  Raleway_700Bold,
  Raleway_800ExtraBold,
  Raleway_900Black,
} from '@expo-google-fonts/raleway';
import { Orbitron_600SemiBold, Orbitron_700Bold, Orbitron_800ExtraBold, Orbitron_900Black } from '@expo-google-fonts/orbitron';
import { applyGlobalFont } from './globalFont';

// Patch Text/TextInput once so the whole app renders in Raleway.
applyGlobalFont();

function AppInner() {
  const { isDarkMode } = useTheme();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF',
      }}
      edges={['top', 'left', 'right']}
    >
      <StatusBar
        style={isDarkMode ? 'light' : 'dark'}
        backgroundColor={isDarkMode ? '#0B0F19' : '#7C5CFF'}
      />
      <AppContainer />
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Raleway_100Thin,
    Raleway_200ExtraLight,
    Raleway_300Light,
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_600SemiBold,
    Raleway_700Bold,
    Raleway_800ExtraBold,
    Raleway_900Black,
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Orbitron_800ExtraBold,
    Orbitron_900Black,
  });

  useEffect(() => {
    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {

        const userId = await AsyncStorage.getItem("userId");
        if (userId) {
          socket.emit("registerPushToken", {
            userId: Number(userId),
            pushToken: token,
          });
        }
      }
    });
  }, []);

  // On web, avoid a11y warning when focus stays in an aria-hidden subtree.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleFocusIn = (event) => {
      const target = event.target;
      const hiddenAncestor = target?.closest?.('[aria-hidden="true"]');
      if (hiddenAncestor) {
        // Move focus out of aria-hidden content to keep screen readers consistent.
        target.blur();
        if (document && document.body) {
          document.body.focus();
        }
      }
    };
    document.addEventListener('focusin', handleFocusIn, true);
    return () => document.removeEventListener('focusin', handleFocusIn, true);
  }, []);


  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F19', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#7C5CFF" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <AppInner />
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>

  )
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if(finalStatus !== 'granted') {
      Alert.alert('Уведомления', 'Не получены разрешения на уведомления!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);
  } else {
    Alert.alert('Уведомления', 'Push notifications не поддерживаются на iOS-симуляторе.');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  return token;
}
