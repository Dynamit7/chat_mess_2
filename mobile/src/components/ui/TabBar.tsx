import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, shadow } from '@/theme/theme';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: { on: 'chatbubble', off: 'chatbubble-outline', label: 'Чаты' },
  groups: { on: 'people', off: 'people-outline', label: 'Группы' },
  channels: { on: 'megaphone', off: 'megaphone-outline', label: 'Каналы' },
  reels: { on: 'newspaper', off: 'newspaper-outline', label: 'Лента' },
  profile: { on: 'person', off: 'person-outline', label: 'Профиль' },
};

/**
 * Glassmorphic floating tab bar. A frosted `BlurView` (intensity 80, dark) sits
 * over the black canvas; the active tab is the only maroon thing here — icon and
 * label both adopt `accent`, with a soft maroon wash behind the icon.
 */
export function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.host, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[styles.bar, shadow.card]}>
        {/* Real blur only on iOS (it clips to the rounded corners there). On Android/web
            BlurView renders on a square surface that ignores the rounded clip, so we use
            a solid rounded fill instead — no square artifact. */}
        {Platform.OS === 'ios' && (
          <View style={styles.clip}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          </View>
        )}
        <View style={styles.barInner}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index;
            const meta = ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline', label: route.name };

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
                accessibilityLabel={meta.label}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={focused ? meta.on : meta.off}
                    size={23}
                    color={focused ? colors.accent : colors.textFaint}
                  />
                </View>
                <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                  {meta.label}
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
    borderColor: colors.stroke2,
    // iOS: translucent so the blur shows through. Android/web: solid graphite (no blur).
    backgroundColor: Platform.OS === 'ios' ? 'rgba(20,20,22,0.55)' : 'rgba(23,18,46,0.97)',
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
    color: colors.textFaint,
    letterSpacing: -0.1,
  },
  labelActive: { color: colors.accent, fontFamily: font.bodySemi },
});
