import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, Switch, Alert } from 'react-native';
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

export default function CreateEntity() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const me = Number(user?.userId);
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const isGroup = kind !== 'channel';
  const noun = isGroup ? 'group' : 'channel';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [avatar, setAvatar] = useState<UploadAsset | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setAvatarUri(a.uri);
    setAvatar({ uri: a.uri, name: a.fileName || 'avatar.jpg', type: a.mimeType || 'image/jpeg' });
  };

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const payload = { userId: me, name: name.trim(), description: description.trim(), isPublic, avatar: avatar || undefined };
      const res = isGroup ? await groupsApi.create(payload) : await channelsApi.create(payload);
      const entity = res?.group || res?.channel || res;
      const id = entity?.id;
      router.back();
      if (id) {
        setTimeout(() => {
          if (isGroup) router.push({ pathname: '/(app)/group/[id]', params: { id: String(id), name: entity.name, avatar: entity.avatar || '', ownerId: String(me), isMember: 'true' } });
          else router.push({ pathname: '/(app)/channel/[id]', params: { id: String(id), name: entity.name, avatar: entity.avatar || '', ownerId: String(me), isMember: 'true' } });
        }, 200);
      }
    } catch (e: any) {
      Alert.alert('Could not create', e?.response?.data?.error || `Failed to create ${noun}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraBackground>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>New {noun}</Text>
        <Pressable hitSlop={10} onPress={() => router.back()}><Ionicons name="close" size={26} color={colors.text} /></Pressable>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 30, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={pickAvatar} style={styles.avatarPick}>
            <Avatar name={name || noun} src={avatarUri} size={92} ring />
            <View style={styles.avatarEdit}><Ionicons name="camera" size={15} color={colors.ink} /></View>
          </Pressable>

          <TextField label="Name" icon={isGroup ? 'people-outline' : 'megaphone-outline'} placeholder={`${isGroup ? 'Group' : 'Channel'} name`} value={name} onChangeText={setName} />
          <TextField label="Description (optional)" icon="text-outline" placeholder="What's it about?" value={description} onChangeText={setDescription} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Public</Text>
              <Text style={styles.toggleSub}>{isPublic ? `Anyone can find and join this ${noun}` : `Invite-only ${noun}`}</Text>
            </View>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.accent, false: colors.stroke2 }} thumbColor={colors.white} />
          </View>

          <Button label={`Create ${noun}`} onPress={submit} loading={loading} disabled={!name.trim()} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 16 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 24 },
  avatarPick: { alignSelf: 'center', marginTop: 6 },
  avatarEdit: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.stroke, borderRadius: 14, padding: 16 },
  toggleLabel: { color: colors.text, fontFamily: font.bodySemi, fontSize: 15 },
  toggleSub: { color: colors.textFaint, fontFamily: font.body, fontSize: 12.5, marginTop: 2 },
});
