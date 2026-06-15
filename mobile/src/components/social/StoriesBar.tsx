import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '@/components/ui/Avatar';
import { storiesApi } from '@/lib/api';
import { groupStories, StoryOwner } from '@/lib/storyGroups';
import { useAuth } from '@/state/auth';
import { colors, font, gradients } from '@/theme/theme';

/** Instagram-style story rings shown above the chat list. */
export function StoriesBar() {
  const { user } = useAuth();
  const router = useRouter();
  const me = Number(user?.userId);
  const [owners, setOwners] = useState<StoryOwner[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    storiesApi.personalized(me)
      .then((data: any) => setOwners(groupStories(Array.isArray(data) ? data : [], me, user?.username || 'You', new Set())))
      .catch(() => {});
  }, [me, user?.username]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addStory = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85, allowsMultipleSelection: true, selectionLimit: 10 });
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      for (const a of res.assets) {
        await storiesApi.create({ userId: me, file: { uri: a.uri, name: a.fileName || 'story', type: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg') } });
      }
      load();
    } catch (e: any) {
      Alert.alert('Не удалось опубликовать историю', e?.response?.data?.error || 'Попробуйте ещё раз.');
    }
    finally { setBusy(false); }
  };

  const mine = owners.find((o) => o.userId === me);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {/* Add / your story */}
      <Pressable style={styles.item} onPress={mine ? () => router.push({ pathname: '/(app)/story', params: { start: '0' } }) : addStory}>
        <View style={styles.addRing}>
          <Avatar name={user?.username} src={user?.avatar} size={50} />
          <Pressable onPress={addStory} style={styles.addBadge} hitSlop={6}>
            <Ionicons name="add" size={13} color={colors.ink} />
          </Pressable>
        </View>
        <Text numberOfLines={1} style={styles.name}>{busy ? 'Posting…' : 'Your story'}</Text>
      </Pressable>

      {owners.filter((o) => o.userId !== me).map((o) => {
        const idx = owners.findIndex((x) => x.userId === o.userId);
        return (
          <Pressable key={o.userId} style={styles.item} onPress={() => router.push({ pathname: '/(app)/story', params: { start: String(idx) } })}>
            {o.hasUnviewed ? (
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                <View style={styles.ringInner}><Avatar name={o.username} src={o.avatar} size={48} /></View>
              </LinearGradient>
            ) : (
              <View style={styles.ringSeen}><Avatar name={o.username} src={o.avatar} size={48} /></View>
            )}
            <Text numberOfLines={1} style={styles.name}>{o.username}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 8, gap: 12 } as any,
  item: { alignItems: 'center', width: 62, gap: 5 },
  ring: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  ringSeen: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.stroke2, alignItems: 'center', justifyContent: 'center' },
  addRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.stroke, alignItems: 'center', justifyContent: 'center' },
  addBadge: { position: 'absolute', right: -1, bottom: -1, width: 21, height: 21, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.bg },
  name: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 11.5 },
});
