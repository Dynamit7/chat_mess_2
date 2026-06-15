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
import { colors, font } from '@/theme/theme';

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Введите email и пароль.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      router.push({ pathname: '/(auth)/verify', params: { userId: String(res.userId), email: email.trim() } });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Не удалось войти. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Reveal delay={60}><Logo /></Reveal>

          <View style={styles.hero}>
            <Reveal delay={140}>
              <Text style={styles.eyebrow}>С ВОЗВРАЩЕНИЕМ</Text>
            </Reveal>
            <Reveal delay={220}>
              <Text style={styles.title}>
                Продолжите{'\n'}с того же{'\n'}
                <Text style={styles.titleAccent}>места.</Text>
              </Text>
            </Reveal>
            <Reveal delay={300}>
              <Text style={styles.subtitle}>Зашифрованные, мгновенные и красиво простые сообщения.</Text>
            </Reveal>
          </View>

          <View style={styles.form}>
            <Reveal delay={380}>
              <TextField
                label="Email"
                icon="mail-outline"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            </Reveal>
            <Reveal delay={450}>
              <TextField
                label="Пароль"
                icon="lock-closed-outline"
                placeholder="••••••••"
                secure
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={onLogin}
              />
            </Reveal>

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Reveal delay={530}>
              <Button label="Войти" onPress={onLogin} loading={loading} style={{ marginTop: 8 }} icon={<Ionicons name="arrow-forward" size={18} color={colors.ink} />} />
            </Reveal>
          </View>

          <Reveal delay={620} style={styles.footer}>
            <Text style={styles.footerText}>Впервые в Rossi?</Text>
            <Pressable hitSlop={8} onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>Создать аккаунт</Text>
            </Pressable>
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 26, flexGrow: 1 },
  hero: { marginTop: 44 },
  eyebrow: { color: colors.accent, fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 3, marginBottom: 14 },
  title: { color: colors.text, fontFamily: font.display, fontSize: 46, lineHeight: 48, letterSpacing: -0.5 },
  titleAccent: { color: colors.accent },
  subtitle: { color: colors.textDim, fontFamily: font.body, fontSize: 15, lineHeight: 22, marginTop: 16 },
  form: { marginTop: 36, gap: 16 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 2 },
  error: { color: colors.danger, fontFamily: font.bodyMed, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingTop: 30 },
  footerText: { color: colors.textDim, fontFamily: font.body, fontSize: 14 },
  link: { color: colors.accent, fontFamily: font.bodySemi, fontSize: 14 },
});
