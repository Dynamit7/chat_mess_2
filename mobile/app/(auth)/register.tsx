import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { Logo } from '@/components/ui/Logo';
import { Reveal } from '@/components/ui/Reveal';
import { TextField } from '@/components/ui/TextField';
import { PhoneInput, e164 } from '@/components/ui/PhoneInput';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/lib/api';
import { useT } from '@/i18n';
import { font, gradients, shadow, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';
import { DEFAULT_COUNTRY, Country } from '@/lib/countries';
import { LinearGradient } from 'expo-linear-gradient';

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onRegister = async () => {
    setError(null);
    if (!username.trim() || !email.trim() || password.length < 6) {
      setError(t('auth.registerHint'));
      return;
    }
    if (phone.replace(/\D/g, '').length < 6) {
      setError(t('auth.invalidPhone'));
      return;
    }
    setLoading(true);
    try {
      await authApi.register({
        username: username.trim(),
        email: email.trim(),
        password,
        phoneNumber: e164(country, phone),
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.error || t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraBackground palette={c}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={c.textDim} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>

          {done ? (
            <View style={styles.successWrap}>
              <Reveal delay={40}>
                <View style={styles.badgeWrap}>
                  <LinearGradient colors={[hexToRgba(c.brand2, 0.5), hexToRgba(c.brand2, 0)]} style={styles.badgeHalo} />
                  <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.badge, shadow.glow]}>
                    <Ionicons name="checkmark" size={42} color="#fff" />
                  </LinearGradient>
                </View>
              </Reveal>
              <Reveal delay={140}><Text style={styles.title}>{t('auth.allDone')}</Text></Reveal>
              <Reveal delay={210}><Text style={[styles.subtitle, { textAlign: 'center' }]}>{t('auth.accountCreated')}</Text></Reveal>
              <Reveal delay={300} style={{ width: '100%', marginTop: 14 }}>
                <Button label={t('auth.goToLogin')} onPress={() => router.replace('/(auth)/login')} palette={c} />
              </Reveal>
            </View>
          ) : (
            <>
              <Reveal delay={50}><Logo palette={c} /></Reveal>
              <View style={styles.hero}>
                <Reveal delay={130}><Text style={styles.eyebrow}>{t('auth.letsStart')}</Text></Reveal>
                <Reveal delay={200}>
                  <Text style={styles.title}>{t('auth.createTitle')}<Text style={styles.accent}>{t('auth.createTitleAccent')}</Text></Text>
                </Reveal>
                <Reveal delay={280}><Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text></Reveal>
              </View>

              <View style={styles.form}>
                <Reveal delay={350}><TextField label={t('auth.username')} icon="person-outline" placeholder="yourname" autoCapitalize="none" value={username} onChangeText={setUsername} palette={c} /></Reveal>
                <Reveal delay={410}><TextField label={t('auth.email')} icon="mail-outline" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} palette={c} /></Reveal>
                <Reveal delay={440}><PhoneInput label={t('auth.phone')} value={phone} onChangeText={setPhone} country={country} onCountryChange={setCountry} palette={c} /></Reveal>
                <Reveal delay={470}><TextField label={t('auth.password')} icon="lock-closed-outline" placeholder={t('auth.minChars')} secure value={password} onChangeText={setPassword} onSubmitEditing={onRegister} palette={c} /></Reveal>

                {error ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={16} color={c.danger} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                <Reveal delay={540}><Button label={t('auth.createAccount')} onPress={onRegister} loading={loading} style={{ marginTop: 6 }} palette={c} /></Reveal>
              </View>

              <Reveal delay={620} style={styles.footer}>
                <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
                <Pressable hitSlop={8} onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.link}>{t('auth.login')}</Text>
                </Pressable>
              </Reveal>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

/** "#RRGGBB" → "rgba(r,g,b,a)"; passes through anything that isn't a 6-digit hex. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const makeStyles = (c: Palette) => StyleSheet.create({
  scroll: { paddingHorizontal: 26, flexGrow: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 18 },
  backText: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 15 },
  hero: { marginTop: 30 },
  eyebrow: { color: c.accent, fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 3, marginBottom: 12 },
  title: { color: c.text, fontFamily: font.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  accent: { color: c.accent },
  subtitle: { color: c.textDim, fontFamily: font.body, fontSize: 15, lineHeight: 22, marginTop: 14 },
  form: { marginTop: 28, gap: 16 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 2 },
  error: { color: c.danger, fontFamily: font.bodyMed, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 'auto', paddingTop: 28 },
  footerText: { color: c.textDim, fontFamily: font.body, fontSize: 14 },
  link: { color: c.accent, fontFamily: font.bodySemi, fontSize: 14 },
  successWrap: { marginTop: 70, alignItems: 'center', gap: 14 },
  badgeWrap: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeHalo: { position: 'absolute', width: 130, height: 130, borderRadius: 65 },
  badge: { width: 90, height: 90, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
