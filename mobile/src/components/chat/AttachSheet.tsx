import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { font, radius, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';

type Tile = { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; tint: string; onPress: () => void };

/**
 * Themed "send attachment" bottom sheet. Replaces the native Alert with a
 * glass panel of round icon tiles that follows the active theme + light/dark.
 */
export function AttachSheet({
  visible,
  onClose,
  onCamera,
  onGallery,
  onFile,
}: {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onFile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { t } = useT();

  const run = (cb: () => void) => () => { onClose(); cb(); };

  const tiles: Tile[] = [
    { key: 'camera', icon: 'camera', label: t('attach.camera'), tint: c.brand2, onPress: run(onCamera) },
    { key: 'gallery', icon: 'images', label: t('attach.gallery'), tint: c.pin, onPress: run(onGallery) },
    { key: 'file', icon: 'document', label: t('attach.file'), tint: c.warning, onPress: run(onFile) },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={18} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={s.scrim} />
      </Pressable>

      <Animated.View entering={SlideInDown.springify().damping(18)} style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />
        <Text style={s.title}>{t('attach.title')}</Text>
        <View style={s.tiles}>
          {tiles.map((tile) => (
            <Pressable key={tile.key} style={s.tile} onPress={tile.onPress}>
              <View style={[s.tileIcon, { backgroundColor: tile.tint + '22', borderColor: tile.tint + '40' }]}>
                <Ionicons name={tile.icon} size={26} color={tile.tint} />
              </View>
              <Text style={s.tileLabel} numberOfLines={1}>{tile.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={({ pressed }) => [s.cancel, pressed && { backgroundColor: c.glass2 }]} onPress={onClose}>
          <Text style={s.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: c.bg2,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    borderWidth: 1, borderColor: c.stroke,
    paddingHorizontal: 18, paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.stroke2, marginBottom: 14 },
  title: { color: c.text, fontFamily: font.bodySemi, fontSize: 17, marginBottom: 18, marginLeft: 2 },
  tiles: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  tile: { alignItems: 'center', gap: 9, flex: 1 },
  tileIcon: {
    width: 62, height: 62, borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  tileLabel: { color: c.textDim, fontFamily: font.bodyMed, fontSize: 13 },
  cancel: {
    marginTop: 8, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke,
  },
  cancelText: { color: c.text, fontFamily: font.bodySemi, fontSize: 16 },
});
