import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/state/auth';
import { colors } from '@/theme/theme';

/** Entry gate: wait for the persisted session, then route to app or auth. */
export default function Index() {
  const { isReady, isAuthed } = useAuth();

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={isAuthed ? '/(app)/(tabs)' : '/(auth)/login'} />;
}
