import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Logo } from '@/components/ui/Logo';
import { Reveal } from '@/components/ui/Reveal';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/lib/api';
import { colors, font, gradients, shadow } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onRegister = async () => {
    setError(null);
    if (!username.trim() || !email.trim() || password.length < 6) {
      setError('Укажите имя пользователя, корректный email и пароль от 6 символов.');
      return;
    }
    setLoading(true);
    try {
      await authApi.register({ username: username.trim(), email: email.trim(), password });
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось создать аккаунт.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.textDim} />
            <Text style={styles.backText}>Назад</Text>
          </Pressable>

          {done ? (
            <View style={styles.successWrap}>
              <Reveal delay={40}>
                <View style={styles.badgeWrap}>
                  <LinearGradient colors={['rgba(45,212,167,0.5)', 'rgba(45,212,167,0)']} style={styles.badgeHalo} />
                  <LinearGradient colors={['#2dd4a7', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.badge, shadow.glow]}>
                    <Ionicons name="checkmark" size={42} color="#fff" />
                  </LinearGradient>
                </View>
              </Reveal>
              <Reveal delay={140}><Text style={styles.title}>Всё готово</Text></Reveal>
              <Reveal delay={210}><Text style={[styles.subtitle, { textAlign: 'center' }]}>Аккаунт создан. Войдите — мы отправим код подтверждения на email.</Text></Reveal>
              <Reveal delay={300} style={{ width: '100%', marginTop: 14 }}>
                <Button label="Перейти ко входу" onPress={() => router.replace('/(auth)/login')} />
              </Reveal>
            </View>
          ) : (
            <>
              <Reveal delay={50}><Logo /></Reveal>
              <View style={styles.hero}>
                <Reveal delay={130}><Text style={styles.eyebrow}>НАЧНЁМ</Text></Reveal>
                <Reveal delay={200}>
                  <Text style={styles.title}>Создайте{'\n'}<Text style={styles.accent}>аккаунт.</Text></Text>
                </Reveal>
                <Reveal delay={280}><Text style={styles.subtitle}>Присоединяйтесь к Rossi за секунды и начните общаться.</Text></Reveal>
              </View>

              <View style={styles.form}>
                <Reveal delay={350}><TextField label="Имя пользователя" icon="person-outline" placeholder="yourname" autoCapitalize="none" value={username} onChangeText={setUsername} /></Reveal>
                <Reveal delay={410}><TextField label="Email" icon="mail-outline" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} /></Reveal>
                <Reveal delay={470}><TextField label="Пароль" icon="lock-closed-outline" placeholder="Минимум 6 символов" secure value={password} onChangeText={setPassword} onSubmitEditing={onRegister} /></Reveal>

                {error ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                <Reveal delay={540}><Button label="Создать аккаунт" onPress={onRegister} loading={loading} style={{ marginTop: 6 }} /></Reveal>
              </View>

              <Reveal delay={620} style={styles.footer}>
                <Text style={styles.footerText}>Уже есть аккаунт?</Text>
                <Pressable hitSlop={8} onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.link}>Войти</Text>
                </Pressable>
              </Reveal>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 26, flexGrow: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 18 },
  backText: { color: colors.textDim, fontFamily: font.bodyMed, fontSize: 15 },
  hero: { marginTop: 30 },
  eyebrow: { color: colors.accent, fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 3, marginBottom: 12 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  accent: { color: colors.accent },
  subtitle: { color: colors.textDim, fontFamily: font.body, fontSize: 15, lineHeight: 22, marginTop: 14 },
  form: { marginTop: 28, gap: 16 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 2 },
  error: { color: colors.danger, fontFamily: font.bodyMed, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingTop: 28 },
  footerText: { color: colors.textDim, fontFamily: font.body, fontSize: 14 },
  link: { color: colors.accent, fontFamily: font.bodySemi, fontSize: 14 },
  successWrap: { marginTop: 70, alignItems: 'center', gap: 14 },
  badgeWrap: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeHalo: { position: 'absolute', width: 130, height: 130, borderRadius: 65 },
  badge: { width: 90, height: 90, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
