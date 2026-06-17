import { Redirect, Stack, useRouter } from 'expo-router';
import { useAuth } from '@/state/auth';
import { useCall } from '@/state/call';
import { IncomingCallModal } from '@/components/calls/IncomingCallModal';
import { useNotificationRouting } from '@/lib/useNotificationRouting';
import { useTheme } from '@/theme/ThemeContext';

export default function AppLayout() {
  const { isReady, isAuthed } = useAuth();
  const router = useRouter();
  const { c } = useTheme();
  const call = useCall();

  // Tapping a push notification routes to the relevant chat/group/channel.
  useNotificationRouting(isReady && isAuthed);

  const incomingCall = call.status === 'incoming' && call.peer
    ? { callerId: call.peer.id, callerName: call.peer.name, callerPicture: call.peer.avatar, isVideo: call.isVideo }
    : null;

  const acceptCall = async () => {
    if (!call.peer) return;
    const peer = call.peer;
    const video = call.isVideo;
    await call.acceptCall();
    router.push({
      pathname: '/(app)/call/[id]',
      params: { id: String(peer.id), name: peer.name, avatar: peer.avatar || '', video: video ? 'true' : 'false' },
    });
  };

  const declineCall = () => call.declineCall();

  if (isReady && !isAuthed) return <Redirect href="/(auth)/login" />;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="group/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="channel/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="call/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="settings/index" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/privacy" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/security" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/appearance" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/translation" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings/blocked" options={{ presentation: 'card' }} />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="new-chat" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="create/[kind]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="edit/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="story" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      <IncomingCallModal call={incomingCall} onAccept={acceptCall} onDecline={declineCall} />
    </>
  );
}
