import { useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { OtpInput } from '@/components/ui/OtpInput';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { authApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useT } from '@/i18n';
import { font, gradients, shadow, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';

export default function Verify() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const { t } = useT();
  const { c: pal } = useTheme();
  const styles = useMemo(() => makeStyles(pal), [pal]);
  const { userId, email } = useLocalSearchParams<{ userId: string; email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const submit = async (value?: string) => {
    const c = value ?? code;
    if (c.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.verifyCode({ userId: Number(userId), code: c });
      if (res.requiresTwoFactor) {
        router.push({ pathname: '/(auth)/two-factor', params: { userId: String(res.userId) } });
        return;
      }
      await signIn({ token: res.token, refreshToken: res.refreshToken, userId: Number(res.userId), username: res.username });
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'That code is invalid or expired.');
      setCode('');
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraBackground palette={pal}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}>
          <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={pal.textDim} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>

          <View style={styles.center}>
            <Reveal delay={60}>
              <View style={styles.iconWrap}>
                <LinearGradient colors={[hexToRgba(pal.brand2, 0.4), hexToRgba(pal.brand2, 0)]} style={styles.iconHalo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <LinearGradient colors={gradients.brand as unknown as readonly [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, shadow.glow]}>
                  <Ionicons name="shield-checkmark" size={34} color={pal.ink} />
                </LinearGradient>
              </View>
            </Reveal>

            <Reveal delay={150}><Text style={styles.title}>{t('auth.checkEmail')}</Text></Reveal>
            <Reveal delay={220}>
              <Text style={styles.subtitle}>
                {t('auth.codeSentTo')}
                <Text style={styles.email}>{email}</Text>
              </Text>
            </Reveal>

            <Reveal delay={300} style={{ marginTop: 30, width: '100%' }}>
              <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={(v) => submit(v)} palette={pal} />
            </Reveal>

            {error ? (
              <Reveal style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={pal.danger} />
                <Text style={styles.error}>{error}</Text>
              </Reveal>
            ) : null}

            <Reveal delay={380} style={{ width: '100%', marginTop: 30 }}>
              <Button label={t('auth.confirm')} onPress={() => submit()} loading={loading} palette={pal} />
            </Reveal>
          </View>
        </View>
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
  container: { flex: 1, paddingHorizontal: 26 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 50 },
  iconWrap: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  iconHalo: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  icon: { width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, fontFamily: font.display, fontSize: 30, letterSpacing: -0.3, marginBottom: 12 },
  subtitle: { color: c.textDim, fontFamily: font.body, fontSize: 15, textAlign: 'center', lineHeight: 23 },
  email: { color: c.text, fontFamily: font.bodySemi },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  error: { color: c.danger, fontFamily: font.bodyMed, fontSize: 13 },
});
