import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { groupsApi, channelsApi, UploadAsset } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { colors, font } from '@/theme/theme';

export default function EditEntity() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const me = Number(user?.userId);
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const entityId = Number(id);
  const isGroup = kind !== 'channel';

  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [avatar, setAvatar] = useState<UploadAsset | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [existingAvatar, setExistingAvatar] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const req = isGroup ? groupsApi.getById(entityId) : channelsApi.getById(entityId);
    req
      .then((data: any) => {
        setName(data?.name || '');
        setIsPublic(data?.isPublic !== false);
        setExistingAvatar(data?.avatar || null);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [entityId, isGroup]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setAvatarUri(a.uri);
    setAvatar({ uri: a.uri, name: a.fileName || 'avatar.jpg', type: a.mimeType || 'image/jpeg' });
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { userId: me, name: name.trim(), isPublic, avatar: avatar || undefined };
      if (isGroup) {
        await groupsApi.update(entityId, payload);
      } else {
        await channelsApi.update(entityId, payload);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось сохранить изменения.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuroraBackground>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Редактировать</Text>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>

      {fetching ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 30, gap: 18 }}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={pickAvatar} style={styles.avatarPick}>
              <Avatar name={name} src={avatarUri || existingAvatar || undefined} size={92} ring />
              <View style={styles.avatarEdit}>
                <Ionicons name="camera" size={15} color={colors.ink} />
              </View>
            </Pressable>

            <TextField
              label="Название"
              icon={isGroup ? 'people-outline' : 'megaphone-outline'}
              placeholder={isGroup ? 'Название группы' : 'Название канала'}
              value={name}
              onChangeText={setName}
            />

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Публичный</Text>
                <Text style={styles.toggleSub}>
                  {isPublic ? 'Любой может найти и вступить' : 'Только по приглашению'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: colors.accent, false: colors.stroke2 }}
                thumbColor={colors.white}
              />
            </View>

            <Button
              label="Сохранить"
              onPress={submit}
              loading={saving}
              disabled={!name.trim()}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingBottom: 16,
  },
  title: { color: colors.text, fontFamily: font.display, fontSize: 24 },
  avatarPick: { alignSelf: 'center', marginTop: 6 },
  avatarEdit: {
    position: 'absolute', right: -2, bottom: -2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.bg,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.stroke,
    borderRadius: 14, padding: 16,
  },
  toggleLabel: { color: colors.text, fontFamily: font.bodySemi, fontSize: 15 },
  toggleSub: { color: colors.textFaint, fontFamily: font.body, fontSize: 12.5, marginTop: 2 },
});
