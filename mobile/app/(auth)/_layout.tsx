import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/state/auth';
import { colors } from '@/theme/theme';

export default function AuthLayout() {
  const { isReady, isAuthed } = useAuth();
  if (isReady && isAuthed) return <Redirect href="/(app)/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
