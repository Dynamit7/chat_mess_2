import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { authApi } from '@/lib/api';
import { useAuth } from '@/state/auth';
import { useT } from '@/i18n';
import { font, gradients, shadow, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';

export default function TwoFactor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const { t } = useT();
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!pwd) {
      setError('Enter your two-factor password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.verifyTwoFactor({ userId: Number(userId), twoFactorPassword: pwd });
      await signIn({ token: res.token, refreshToken: res.refreshToken, userId: Number(res.userId), username: res.username });
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Incorrect two-factor password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraBackground palette={c}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}>
          <Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={c.textDim} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>

          <View style={styles.center}>
            <Reveal delay={60}>
              <View style={styles.iconWrap}>
                <LinearGradient colors={[hexToRgba(c.brand2, 0.4), hexToRgba(c.brand2, 0)]} style={styles.iconHalo} />
                <LinearGradient colors={gradients.brand as unknown as readonly [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, shadow.glow]}>
                  <Ionicons name="lock-closed" size={32} color={c.ink} />
                </LinearGradient>
              </View>
            </Reveal>
            <Reveal delay={150}><Text style={styles.title}>{t('auth.twoFactorTitle')}</Text></Reveal>
            <Reveal delay={220}><Text style={styles.subtitle}>{t('auth.twoFactorSubtitle')}</Text></Reveal>

            <Reveal delay={300} style={{ marginTop: 28, width: '100%' }}>
              <TextField icon="key-outline" placeholder={t('auth.twoFactorPassword')} secure value={pwd} onChangeText={setPwd} onSubmitEditing={submit} palette={c} />
            </Reveal>
            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={c.danger} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}
            <Reveal delay={370} style={{ width: '100%', marginTop: 22 }}>
              <Button label={t('auth.continue')} onPress={submit} loading={loading} palette={c} />
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
  iconWrap: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  iconHalo: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  icon: { width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, fontFamily: font.display, fontSize: 28, letterSpacing: -0.3, marginBottom: 12, textAlign: 'center' },
  subtitle: { color: c.textDim, fontFamily: font.body, fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 6 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  error: { color: c.danger, fontFamily: font.bodyMed, fontSize: 13 },
});
