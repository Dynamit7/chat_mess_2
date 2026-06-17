import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, shadow } from '@/theme/theme';
import { useT, TKey } from '@/i18n';
import { useTheme } from '@/theme/ThemeContext';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: TKey }> = {
  index: { on: 'chatbubble', off: 'chatbubble-outline', label: 'tabs.chats' },
  groups: { on: 'people', off: 'people-outline', label: 'tabs.groups' },
  channels: { on: 'megaphone', off: 'megaphone-outline', label: 'tabs.channels' },
  reels: { on: 'newspaper', off: 'newspaper-outline', label: 'tabs.feed' },
  profile: { on: 'person', off: 'person-outline', label: 'tabs.profile' },
};

/**
 * Glassmorphic floating tab bar. A frosted `BlurView` (intensity 80, dark) sits
 * over the black canvas; the active tab is the only maroon thing here — icon and
 * label both adopt `accent`, with a soft maroon wash behind the icon.
 */
export function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { c, scheme } = useTheme();
  const isLight = scheme === 'light';

  return (
    <View style={[styles.host, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[
        styles.bar,
        shadow.card,
        {
          borderColor: c.stroke2,
          backgroundColor: Platform.OS === 'ios'
            ? (isLight ? 'rgba(255,255,255,0.65)' : 'rgba(20,20,22,0.55)')
            : (isLight ? 'rgba(255,255,255,0.97)' : 'rgba(23,18,46,0.97)'),
        },
      ]}>
        {/* Real blur only on iOS (it clips to the rounded corners there). On Android/web
            BlurView renders on a square surface that ignores the rounded clip, so we use
            a solid rounded fill instead — no square artifact. */}
        {Platform.OS === 'ios' && (
          <View style={styles.clip}>
            <BlurView intensity={80} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
          </View>
        )}
        <View style={styles.barInner}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index;
            const meta = ICONS[route.name];
            const icon = { on: meta?.on ?? 'ellipse', off: meta?.off ?? 'ellipse-outline' };
            const label = meta ? t(meta.label) : route.name;

            const onPress = () => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.item}
                hitSlop={6}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={focused ? icon.on : icon.off}
                    size={23}
                    color={focused ? c.accent : c.textFaint}
                  />
                </View>
                <Text style={[styles.label, { color: focused ? c.accent : c.textFaint }, focused && styles.labelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    marginHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    // borderColor + backgroundColor are applied inline from the active palette.
  },
  // Clip the blur in its own layer. Keeping overflow:hidden OFF the bar lets the bar
  // cast a *rounded* shadow — overflow:hidden + shadow on one view = a square shadow.
  clip: { ...StyleSheet.absoluteFillObject, borderRadius: 24, overflow: 'hidden' },
  barInner: { flex: 1, flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 9 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap: {
    width: 46,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: font.bodyMed,
    fontSize: 10.5,
    letterSpacing: -0.1,
  },
  labelActive: { fontFamily: font.bodySemi },
});
