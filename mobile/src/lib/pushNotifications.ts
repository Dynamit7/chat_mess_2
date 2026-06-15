import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Register for push notifications and return the Expo push token (or null).
 *
 * NOTE: Remote push was removed from Expo Go in SDK 53+, so in Expo Go this is a
 * no-op — we skip it entirely (and avoid even importing `expo-notifications`, whose
 * module-load side effect logs a scary "removed from Expo Go" error). To get real
 * push tokens, run a development build: https://docs.expo.dev/develop/development-builds/introduction/
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  // Expo Go reports executionEnvironment === 'storeClient'.
  if (Constants.executionEnvironment === 'storeClient') return null;

  // Lazy require so the expo-notifications auto-registration side effect never
  // runs in Expo Go (the early return above guards this path).
  const Notifications = require('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A78BFA',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId as string | undefined;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch {
    return null;
  }
}
