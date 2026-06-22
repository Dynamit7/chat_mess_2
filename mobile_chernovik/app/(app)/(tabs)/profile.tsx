import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/state/auth';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';
import { usersApi } from '@/lib/api';
import { font, radius, Palette } from '@/theme/theme';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; danger?: boolean };

export default function ProfileScreen() {
  const { user, signOut, updateProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { c, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isFocused = useIsFocused();
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
      if (newUrl) {
        // Persist on the server (not just local state) so the new avatar shows in
        // chat lists and to other users — keep username/nickname so they aren't wiped.
        await usersApi.updateProfile({
          userId: Number(user!.userId),
          username: user?.username,
          nickname: user?.nickname,
          avatar: newUrl,
        });
        await updateProfile({ avatar: newUrl });
      }
    } catch {
      Alert.alert('Upload failed', 'Could not update your avatar. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  const account: Row[] = [
    { icon: 'create-outline', label: t('profile.editProfile'), onPress: () => router.push('/(app)/edit-profile') },
    { icon: 'person-outline', label: t('profile.username'), value: user?.username || '—' },
  ];
  const settings: Row[] = [
    { icon: 'shield-checkmark-outline', label: t('nav.privacy'), onPress: () => router.push('/(app)/settings/privacy') },
    { icon: 'lock-closed-outline', label: t('nav.security'), onPress: () => router.push('/(app)/settings/security') },
    { icon: 'color-palette-outline', label: t('nav.appearance'), onPress: () => router.push('/(app)/settings/appearance') },
    { icon: 'language-outline', label: t('nav.translation'), onPress: () => router.push('/(app)/settings/translation') },
    { icon: 'person-remove-outline', label: t('nav.blocked'), onPress: () => router.push('/(app)/settings/blocked') },
  ];

  return (
    <AuroraBackground palette={c}>
      {isFocused ? <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /> : null}
      <ScreenHeader title={t('tabs.profile')} palette={c} actions={[{ icon: 'settings-outline', onPress: () => router.push('/(app)/settings') }]} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Pressable onPress={changeAvatar}>
            <Avatar name={user?.username} src={user?.avatar} size={104} ring palette={c} />
            <View style={styles.editDot}>
              {uploading ? <ActivityIndicator size="small" color={c.ink} /> : <Ionicons name="camera" size={16} color={c.ink} />}
            </View>
          </Pressable>
          <Text style={styles.name}>{user?.username || t('profile.yourName')}</Text>
          <Text style={styles.handle}>{t('profile.online')}</Text>
        </View>

        <SectionLabel text={t('profile.account')} styles={styles} />
        <GlassCard padded={false} palette={c}><RowList rows={account} styles={styles} c={c} /></GlassCard>

        <SectionLabel text={t('profile.settings')} styles={styles} />
        <GlassCard padded={false} palette={c}><RowList rows={settings} styles={styles} c={c} /></GlassCard>

        <Pressable onPress={confirmSignOut} style={styles.signOut}>
          <Ionicons name="log-out-outline" size={20} color={c.danger} />
          <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </AuroraBackground>
  );
}

function SectionLabel({ text, styles }: { text: string; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={styles.section}>{text}</Text>;
}

function RowList({ rows, styles, c }: { rows: Row[]; styles: ReturnType<typeof makeStyles>; c: Palette }) {
  return (
    <View>
      {rows.map((r, i) => (
        <Pressable key={r.label} onPress={r.onPress} disabled={!r.onPress} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
          <View style={styles.rowIcon}><Ionicons name={r.icon} size={19} color={r.danger ? c.danger : c.accent} /></View>
          <Text style={[styles.rowLabel, r.danger && { color: c.danger }]}>{r.label}</Text>
          <View style={{ flex: 1 }} />
          {r.value ? <Text style={styles.rowValue}>{r.value}</Text> : r.onPress ? <Ionicons name="chevron-forward" size={18} color={c.textFaint} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  identity: { alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 18 },
  editDot: {
    position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17,
    backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg,
  },
  name: { color: c.text, fontFamily: font.display, fontSize: 24, marginTop: 6 },
  handle: { color: c.online, fontFamily: font.bodyMed, fontSize: 13 },
  section: { color: c.textFaint, fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.stroke },
  rowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: c.text, fontFamily: font.bodyMed, fontSize: 15 },
  rowValue: { color: c.textDim, fontFamily: font.body, fontSize: 14 },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 26,
    height: 54, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(251,92,114,0.4)', backgroundColor: 'rgba(251,92,114,0.08)',
  },
  signOutText: { color: c.danger, fontFamily: font.bodySemi, fontSize: 16 },
});
