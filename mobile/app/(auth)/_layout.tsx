import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/theme/ThemeContext';

export default function AuthLayout() {
  const { isReady, isAuthed } = useAuth();
  const { c } = useTheme();
  if (isReady && isAuthed) return <Redirect href="/(app)/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
