import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addNotificationResponseListener, getInitialNotificationData, PushData } from './pushNotifications';

const COLD_START_KEY = 'push.lastColdStartId';

type Router = ReturnType<typeof useRouter>;

/**
 * Map a push `data` payload to a screen. The backend sends `{ type, ...data }`;
 * for a direct message `fromUserId` is the partner, plus `senderUsername` /
 * `senderPicture` for the header. Group/channel/friend types are handled
 * defensively for when the backend starts enqueuing them.
 */
function navigateFromPush(router: Router, data: PushData) {
  if (!data || !data.type) return;
  switch (data.type) {
    case 'message': {
      const id = data.fromUserId ?? data.userId;
      if (id == null) return;
      router.push({
        pathname: '/(app)/chat/[id]',
        params: { id: String(id), name: data.senderUsername || '', avatar: data.senderPicture || '' },
      });
      break;
    }
    case 'groupMessage': {
      if (data.groupId == null) return;
      router.push({
        pathname: '/(app)/group/[id]',
        params: { id: String(data.groupId), name: data.groupName || '', avatar: data.groupPicture || '' },
      });
      break;
    }
    case 'channelMessage': {
      if (data.channelId == null) return;
      router.push({
        pathname: '/(app)/channel/[id]',
        params: { id: String(data.channelId), name: data.channelName || '', avatar: data.channelPicture || '' },
      });
      break;
    }
    case 'friendRequest': {
      if (data.fromUserId == null) return;
      router.push({ pathname: '/(app)/user/[id]', params: { id: String(data.fromUserId) } });
      break;
    }
  }
}

/**
 * Wire notification taps to navigation. Enable only once the user is authed and
 * the router is mounted (call from the authed layout). Handles both the
 * cold-start case (app launched from a tapped notification) and live taps while
 * the app is running. No-op in Expo Go / web (remote push unavailable there).
 */
export function useNotificationRouting(active: boolean) {
  const router = useRouter();
  const coldStartHandled = useRef(false);

  useEffect(() => {
    if (!active) return;

    // App launched by tapping a notification while killed — handle once per
    // process, and dedupe by id so an ordinary open (where some platforms still
    // report the last response) doesn't navigate again.
    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      getInitialNotificationData().then(async (initial) => {
        if (!initial) return;
        const lastId = await AsyncStorage.getItem(COLD_START_KEY);
        if (lastId === initial.id) return;
        await AsyncStorage.setItem(COLD_START_KEY, initial.id);
        navigateFromPush(router, initial.data);
      });
    }

    // Taps while the app is in foreground/background.
    const unsub = addNotificationResponseListener((data) => navigateFromPush(router, data));
    return () => { unsub?.(); };
  }, [active, router]);
}
