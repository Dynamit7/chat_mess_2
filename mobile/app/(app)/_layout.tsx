import { useState, useEffect } from 'react';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useAuth } from '@/state/auth';
import { useSocket } from '@/state/socket';
import { IncomingCallModal } from '@/components/calls/IncomingCallModal';
import { colors } from '@/theme/theme';

type IncomingCallData = { callerId: number; callerName: string; callerPicture?: string; isVideo?: boolean };

export default function AppLayout() {
  const { isReady, isAuthed } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  useEffect(() => {
    const onIncoming = (data: IncomingCallData) => setIncomingCall(data);
    socket.on('incomingCall', onIncoming);
    return () => { socket.off('incomingCall', onIncoming); };
  }, [socket]);

  const acceptCall = () => {
    if (!incomingCall) return;
    socket.emit('acceptCall', { to: incomingCall.callerId });
    const call = incomingCall;
    setIncomingCall(null);
    router.push({
      pathname: '/(app)/call/[id]',
      params: { id: String(call.callerId), name: call.callerName, avatar: call.callerPicture || '', incoming: 'true' },
    });
  };

  const declineCall = () => {
    if (!incomingCall) return;
    socket.emit('declineCall', { to: incomingCall.callerId });
    setIncomingCall(null);
  };

  if (isReady && !isAuthed) return <Redirect href="/(auth)/login" />;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="group/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="channel/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="call/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
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
