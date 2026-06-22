import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo } from 'react';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { usersApi, UploadAsset } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';
import { font, radius, Palette } from '@/theme/theme';

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const { c, scheme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const me = Number(user?.userId);

  const [username, setUsername] = useState(user?.username || '');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState('');
  const [existingAvatar, setExistingAvatar] = useState<string | undefined>(user?.avatar);
  const [pickedAvatar, setPickedAvatar] = useState<UploadAsset | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load the latest profile so nickname / bio / avatar reflect server state.
  useEffect(() => {
    usersApi
      .getById(me)
      .then((u: any) => {
        if (u?.username) setUsername(u.username);
        setNickname(u?.nickname || '');
        setBio(u?.bio || '');
        if (u?.avatar) setExistingAvatar(u.avatar);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [me]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('edit.needAccess'), t('edit.photoPerm'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setPickedUri(a.uri);
    setPickedAvatar({ uri: a.uri, name: a.fileName || 'avatar.jpg', type: a.mimeType || 'image/jpeg' });
  };

  const submit = async () => {
    if (!username.trim()) return;
    setSaving(true);
    try {
      let avatarUrl = existingAvatar;
      if (pickedAvatar) {
        const out: any = await usersApi.uploadAvatar(me, pickedAvatar);
        avatarUrl = out?.avatar || out?.url || out?.avatarUrl || avatarUrl;
      }
      await usersApi.updateProfile({
        userId: me,
        username: username.trim(),
        nickname: nickname.trim(),
        avatar: avatarUrl,
        bio: bio.trim(),
      });
      await updateProfile({ username: username.trim(), nickname: nickname.trim(), avatar: avatarUrl });
      router.back();
    } catch (e: any) {
      Alert.alert(t('edit.errorTitle'), e?.response?.data?.message || e?.response?.data?.error || t('edit.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuroraBackground palette={c}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>{t('profile.editProfile')}</Text>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
      </View>

      {fetching ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 30, gap: 18 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={pickAvatar} style={styles.avatarPick}>
              <Avatar name={username} src={pickedUri || existingAvatar} size={96} ring palette={c} />
              <View style={styles.avatarEdit}>
                <Ionicons name="camera" size={15} color={c.ink} />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>{t('edit.changePhoto')}</Text>

            <TextField
              label={t('edit.name')}
              icon="person-outline"
              placeholder={t('edit.namePh')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              palette={c}
            />

            <TextField
              label={t('edit.nickname')}
              icon="at-outline"
              placeholder={t('edit.nicknamePh')}
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="none"
              palette={c}
            />

            <View style={styles.bioWrap}>
              <Text style={styles.bioLabel}>{t('edit.bio')}</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder={t('edit.bioPh')}
                placeholderTextColor={c.textFaint}
                multiline
                maxLength={200}
                style={styles.bioInput}
              />
              <Text style={styles.bioCount}>{bio.length}/200</Text>
            </View>

            <Button
              label={t('common.save')}
              onPress={submit}
              loading={saving}
              disabled={!username.trim()}
              style={{ marginTop: 8 }}
              palette={c}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </AuroraBackground>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingBottom: 16,
  },
  title: { color: c.text, fontFamily: font.display, fontSize: 24 },
  avatarPick: { alignSelf: 'center', marginTop: 6 },
  avatarEdit: {
    position: 'absolute', right: -2, bottom: -2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: c.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: c.bg,
  },
  avatarHint: { color: c.textFaint, fontFamily: font.body, fontSize: 13, textAlign: 'center', marginTop: -6 },
  bioWrap: { width: '100%', gap: 8 },
  bioLabel: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 13, marginLeft: 4, letterSpacing: 0.2 },
  bioInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.stroke,
    borderRadius: radius.md, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    minHeight: 96, color: c.text, fontFamily: font.body, fontSize: 16,
    textAlignVertical: 'top',
  },
  bioCount: { color: c.textFaint, fontFamily: font.body, fontSize: 12, alignSelf: 'flex-end', marginRight: 4 },
});
