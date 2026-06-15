import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { colors, font, radius } from '@/theme/theme';

export default function NewChat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const me = Number(user?.userId);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    setTouched(true);
    debounce.current = setTimeout(async () => {
      try {
        const data = await usersApi.search(q, me);
        setResults(Array.isArray(data) ? data : data?.users || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, me]);

  const open = (u: any) => {
    const id = u.id ?? u.userId;
    router.replace({ pathname: '/(app)/chat/[id]', params: { id: String(id), name: u.username || u.nickname || 'Chat', avatar: u.avatar || '' } });
  };

  return (
    <AuroraBackground>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>New chat</Text>
        <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)'))}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people by username"
          placeholderTextColor={colors.textFaint}
          style={styles.search}
          autoFocus
          autoCapitalize="none"
        />
        {query ? (
          <Pressable hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : results.length === 0 ? (
        <EmptyState
          icon={touched ? 'sad-outline' : 'search-outline'}
          title={touched ? 'No one found' : 'Find your people'}
          body={touched ? 'Try a different username.' : 'Type a username to search and start a conversation.'}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(u) => String(u.id ?? u.userId)}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.glass }]}>
              <Avatar name={item.username || item.nickname} src={item.avatar} size={50} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.username || item.nickname || 'User'}</Text>
                {item.nickname && item.username !== item.nickname ? <Text style={styles.sub}>@{item.nickname}</Text> : null}
              </View>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.accent} />
            </Pressable>
          )}
        />
      )}
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 24 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 12,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.stroke, borderRadius: radius.md, paddingHorizontal: 16, height: 52,
  },
  search: { flex: 1, color: colors.text, fontFamily: font.body, fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 16 },
  name: { color: colors.text, fontFamily: font.bodySemi, fontSize: 16 },
  sub: { color: colors.textFaint, fontFamily: font.body, fontSize: 13, marginTop: 2 },
});
