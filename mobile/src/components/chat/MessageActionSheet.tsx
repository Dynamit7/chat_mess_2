import { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useT } from '@/i18n';
import type { Message } from '@/lib/api';

const QUICK = ['❤️', '😂', '👍', '🔥', '😮', '😢', '🙏'];

// Curated set for the full picker.
const EMOJIS = [
  '❤️','😂','👍','🔥','😮','😢','🙏','👏','😍','🥰','😘','😎','🤩','🥳','😅','😇',
  '🙂','😉','😋','😜','🤪','🤔','🤨','😐','😴','😭','😡','🤬','😱','🤯','😬','🙄',
  '😏','😌','🤗','🤭','🤫','🫡','🤝','💪','🙌','👌','✌️','🤞','🤙','👋','🫶','💯',
  '✨','⭐','🌟','💫','⚡','💥','🎉','🎊','🥂','☕','🍕','🎁','💎','🏆','✅','❌',
  '💔','💖','💙','💚','💛','💜','🖤','🤍','😈','👻','💀','🤡','👀','🫠','😤','🥹',
];

type Action = 'reply' | 'edit' | 'copy' | 'forward' | 'delete' | 'select';

export function MessageActionSheet({
  message,
  isOut,
  onClose,
  onReact,
  onAction,
}: {
  message: Message | null;
  isOut: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onAction: (action: Action) => void;
}) {
  const insets = useSafeAreaInsets();
  const { c, scheme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const visible = !!message;
  const [showAll, setShowAll] = useState(false);

  // Reset to the quick bar whenever the sheet target changes.
  useEffect(() => { if (!message) setShowAll(false); }, [message]);

  const items: { key: Action; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean; show: boolean }[] = [
    { key: 'reply', label: t('msg.reply'), icon: 'arrow-undo-outline', show: true },
    { key: 'forward', label: t('msg.forward'), icon: 'arrow-redo-outline', show: true },
    { key: 'copy', label: t('msg.copy'), icon: 'copy-outline', show: !!message?.text },
    { key: 'select', label: t('msg.select'), icon: 'checkmark-circle-outline', show: true },
    { key: 'edit', label: t('msg.edit'), icon: 'create-outline', show: isOut && !!message?.text },
    { key: 'delete', label: t('common.delete'), icon: 'trash-outline', danger: true, show: isOut },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={20} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={styles.scrim} />
      </Pressable>
      <Animated.View entering={SlideInDown.duration(220)} style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
        {showAll ? (
          <View style={styles.gridPanel}>
            <View style={styles.gridHeader}>
              <Pressable hitSlop={8} onPress={() => setShowAll(false)} style={styles.gridBack}>
                <Ionicons name="chevron-back" size={20} color={c.text} />
              </Pressable>
              <Text style={styles.gridTitle}>{t('msg.reactions')}</Text>
              <View style={{ width: 28 }} />
            </View>
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {EMOJIS.map((e, i) => (
                <Pressable key={`${e}_${i}`} onPress={() => onReact(e)} style={({ pressed }) => [styles.gridBtn, pressed && { backgroundColor: c.glass2 }]}>
                  <Text style={styles.gridEmoji}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <>
            <View style={styles.reactBar}>
              {QUICK.map((e) => (
                <Pressable key={e} onPress={() => onReact(e)} style={({ pressed }) => [styles.reactBtn, pressed && { backgroundColor: c.glass2, transform: [{ scale: 1.15 }] }]}>
                  <Text style={styles.reactEmoji}>{e}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setShowAll(true)} style={({ pressed }) => [styles.reactBtn, pressed && { backgroundColor: c.glass2 }]}>
                <Ionicons name="add" size={24} color={c.textDim} />
              </Pressable>
            </View>

            <View style={styles.menu}>
              {items.filter((i) => i.show).map((it, idx, arr) => (
                <Pressable
                  key={it.key}
                  onPress={() => onAction(it.key)}
                  style={({ pressed }) => [styles.menuItem, idx < arr.length - 1 && styles.menuBorder, pressed && { backgroundColor: c.glass }]}
                >
                  <Text style={[styles.menuLabel, it.danger && { color: c.danger }]}>{it.label}</Text>
                  <Ionicons name={it.icon} size={20} color={it.danger ? c.danger : c.text} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, gap: 12 },
  reactBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'center',
    backgroundColor: c.bg3, borderRadius: radius.full, borderWidth: 1, borderColor: c.stroke,
    paddingHorizontal: 10, paddingVertical: 8, gap: 2,
  },
  reactBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  reactEmoji: { fontSize: 26 },
  menu: { backgroundColor: c.bg3, borderRadius: radius.lg, borderWidth: 1, borderColor: c.stroke, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: c.stroke },
  menuLabel: { color: c.text, fontFamily: font.bodyMed, fontSize: 16 },

  gridPanel: { backgroundColor: c.bg3, borderRadius: radius.lg, borderWidth: 1, borderColor: c.stroke, overflow: 'hidden' },
  gridHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.stroke },
  gridBack: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  gridTitle: { color: c.text, fontFamily: font.bodySemi, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  gridBtn: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  gridEmoji: { fontSize: 26 },
});
