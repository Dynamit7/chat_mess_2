import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, Switch, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo } from 'react';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { groupsApi, channelsApi, UploadAsset } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/theme/ThemeContext';
import { font, Palette } from '@/theme/theme';

export default function CreateEntity() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { c, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
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
    <AuroraBackground palette={c}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>New {noun}</Text>
        <Pressable hitSlop={10} onPress={() => router.back()}><Ionicons name="close" size={26} color={c.text} /></Pressable>
      </View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 30, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={pickAvatar} style={styles.avatarPick}>
            <Avatar name={name || noun} src={avatarUri} size={92} ring palette={c} />
            <View style={styles.avatarEdit}><Ionicons name="camera" size={15} color={c.ink} /></View>
          </Pressable>

          <TextField label="Name" icon={isGroup ? 'people-outline' : 'megaphone-outline'} placeholder={`${isGroup ? 'Group' : 'Channel'} name`} value={name} onChangeText={setName} palette={c} />
          <TextField label="Description (optional)" icon="text-outline" placeholder="What's it about?" value={description} onChangeText={setDescription} palette={c} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Public</Text>
              <Text style={styles.toggleSub}>{isPublic ? `Anyone can find and join this ${noun}` : `Invite-only ${noun}`}</Text>
            </View>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: c.accent, false: c.stroke2 }} thumbColor={c.white} />
          </View>

          <Button label={`Create ${noun}`} onPress={submit} loading={loading} disabled={!name.trim()} style={{ marginTop: 8 }} palette={c} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 16 },
  title: { color: c.text, fontFamily: font.display, fontSize: 24 },
  avatarPick: { alignSelf: 'center', marginTop: 6 },
  avatarEdit: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke, borderRadius: 14, padding: 16 },
  toggleLabel: { color: c.text, fontFamily: font.bodySemi, fontSize: 15 },
  toggleSub: { color: c.textFaint, fontFamily: font.body, fontSize: 12.5, marginTop: 2 },
});
