import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/state/auth';
import { usersApi } from '@/lib/api';
import { colors, font, radius } from '@/theme/theme';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; danger?: boolean };

export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change your avatar.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const out = await usersApi.uploadAvatar(Number(user!.userId), { uri: asset.uri, name: asset.fileName || 'avatar.jpg', type: asset.mimeType || 'image/jpeg' });
      const newUrl = out?.avatar || out?.url || out?.avatarUrl;
      if (newUrl) await updateProfile({ avatar: newUrl });
    } catch {
      Alert.alert('Upload failed', 'Could not update your avatar. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  const account: Row[] = [
    { icon: 'create-outline', label: 'Изменить профиль', onPress: () => router.push('/(app)/edit-profile') },
    { icon: 'person-outline', label: 'Имя пользователя', value: user?.username || '—' },
  ];
  const openSettings = (section?: string) =>
    router.push({ pathname: '/(app)/settings', params: section ? { section } : {} });
  const settings: Row[] = [
    { icon: 'shield-checkmark-outline', label: 'Приватность', onPress: () => openSettings('privacy') },
    { icon: 'lock-closed-outline', label: 'Безопасность', onPress: () => openSettings('security') },
    { icon: 'language-outline', label: 'Перевод и язык', onPress: () => openSettings('translation') },
    { icon: 'person-remove-outline', label: 'Заблокированные', onPress: () => openSettings('blocked') },
  ];

  return (
    <AuroraBackground>
      <ScreenHeader title="Профиль" actions={[{ icon: 'settings-outline', onPress: () => router.push('/(app)/settings') }]} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Pressable onPress={changeAvatar}>
            <Avatar name={user?.username} src={user?.avatar} size={104} ring />
            <View style={styles.editDot}>
              {uploading ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="camera" size={16} color={colors.ink} />}
            </View>
          </Pressable>
          <Text style={styles.name}>{user?.username || 'Ваше имя'}</Text>
          <Text style={styles.handle}>В сети</Text>
        </View>

        <SectionLabel text="Аккаунт" />
        <GlassCard padded={false}><RowList rows={account} /></GlassCard>

        <SectionLabel text="Настройки" />
        <GlassCard padded={false}><RowList rows={settings} /></GlassCard>

        <Pressable onPress={confirmSignOut} style={styles.signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Выйти</Text>
        </Pressable>
      </ScrollView>
    </AuroraBackground>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.section}>{text}</Text>;
}

function RowList({ rows }: { rows: Row[] }) {
  return (
    <View>
      {rows.map((r, i) => (
        <Pressable key={r.label} onPress={r.onPress} disabled={!r.onPress} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
          <View style={styles.rowIcon}><Ionicons name={r.icon} size={19} color={r.danger ? colors.danger : colors.accent} /></View>
          <Text style={[styles.rowLabel, r.danger && { color: colors.danger }]}>{r.label}</Text>
          <View style={{ flex: 1 }} />
          {r.value ? <Text style={styles.rowValue}>{r.value}</Text> : r.onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 18 },
  editDot: {
    position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg,
  },
  name: { color: colors.text, fontFamily: font.display, fontSize: 24, marginTop: 6 },
  handle: { color: colors.online, fontFamily: font.bodyMed, fontSize: 13 },
  section: { color: colors.textFaint, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.stroke },
  rowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: colors.text, fontFamily: font.bodyMed, fontSize: 15 },
  rowValue: { color: colors.textDim, fontFamily: font.body, fontSize: 14 },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 26,
    height: 54, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(251,92,114,0.4)', backgroundColor: 'rgba(251,92,114,0.08)',
  },
  signOutText: { color: colors.danger, fontFamily: font.bodySemi, fontSize: 16 },
});
