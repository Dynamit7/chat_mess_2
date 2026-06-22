import { useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui/Avatar';
import { useT } from '@/i18n';
import { colors, font, radius, Palette } from '@/theme/theme';
import { relativeShort, previewOf } from '@/lib/format';
import type { ChatSummary } from '@/lib/api';

const BTN_W = 80;

function RightActions({
  muted,
  pinned,
  onMute,
  onPin,
  onDelete,
  swipeable,
  drag,
  styles,
  c,
}: {
  muted?: boolean;
  pinned?: boolean;
  onMute?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  swipeable: SwipeableMethods;
  drag: SharedValue<number>;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}) {
  const { t } = useT();
  const count = (onMute ? 1 : 0) + (onPin ? 1 : 0) + (onDelete ? 1 : 0);
  const totalW = count * BTN_W;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(drag.value, [-totalW, 0], [0, totalW], Extrapolation.CLAMP),
    }],
  }));

  const handle = (cb?: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    swipeable.close();
    cb?.();
  };

  return (
    <Animated.View style={[styles.actionsRow, animStyle]}>
      {onMute && (
        <Pressable style={[styles.action, { backgroundColor: c.mute }]} onPress={handle(onMute)}>
          <Ionicons name={muted ? 'volume-high' : 'volume-mute'} size={22} color="#fff" />
          <Text style={styles.actionLabel}>{muted ? t('action.unmute') : t('action.mute')}</Text>
        </Pressable>
      )}
      {onPin && (
        <Pressable style={[styles.action, { backgroundColor: c.pin }]} onPress={handle(onPin)}>
          <Ionicons name={pinned ? 'pin-outline' : 'pin'} size={22} color="#fff" />
          <Text style={styles.actionLabel}>{pinned ? t('action.unpin') : t('action.pin')}</Text>
        </Pressable>
      )}
      {onDelete && (
        <Pressable style={[styles.action, { backgroundColor: c.danger }]} onPress={handle(onDelete)}>
          <Ionicons name="trash" size={22} color="#fff" />
          <Text style={styles.actionLabel}>{t('common.delete')}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export function ChatRow({
  chat,
  online,
  muted,
  pinned,
  onPress,
  onAvatarPress,
  onMute,
  onPin,
  onDelete,
  onLongPress,
  selectionMode,
  selected,
  draft,
  palette = colors,
}: {
  chat: ChatSummary;
  online?: boolean;
  muted?: boolean;
  pinned?: boolean;
  onPress: () => void;
  onAvatarPress?: () => void;
  onMute?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  draft?: string;
  palette?: Palette;
}) {
  const c = palette;
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const swipeRef = useRef<SwipeableMethods>(null);
  const unread = chat.unreadCount || 0;
  const preview = previewOf(chat.lastMessage, chat.lastMessageType);
  const hasActions = !!(onMute || onPin || onDelete);

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      enabled={hasActions && !selectionMode}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      overshootFriction={8}
      renderRightActions={(_prog, drag, swipeable) => (
        <RightActions muted={muted} pinned={pinned} onMute={onMute} onPin={onPin} onDelete={onDelete} swipeable={swipeable} drag={drag} styles={styles} c={c} />
      )}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={220}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed, selected && styles.rowSelected]}
        android_ripple={{ color: c.glass2 }}
      >
        {unread > 0 && <View style={styles.unreadBar} />}

        {selectionMode && (
          <View style={[styles.checkbox, selected && styles.checkboxOn]}>
            {selected ? <Ionicons name="checkmark" size={15} color={c.ink} /> : null}
          </View>
        )}

        <Pressable onPress={onAvatarPress ?? onPress} hitSlop={4}>
          <Avatar name={chat.username} src={chat.picture} size={54} online={online} ring={online} palette={c} />
        </Pressable>

        <View style={styles.body}>
          <View style={styles.line}>
            <View style={styles.nameWrap}>
              {pinned && <Ionicons name="pin" size={12} color={c.textFaint} style={styles.pinIcon} />}
              <Text numberOfLines={1} style={[styles.name, unread > 0 && styles.nameBold]}>
                {chat.username || 'Unknown'}
              </Text>
            </View>
            <Text style={[styles.time, unread > 0 && styles.timeAccent]}>
              {relativeShort(chat.time)}
            </Text>
          </View>

          <View style={styles.line}>
            {draft ? (
              <Text numberOfLines={1} style={styles.preview}>
                <Text style={styles.draftLabel}>{t('chat.draft')}: </Text>
                <Text style={styles.draftText}>{draft}</Text>
              </Text>
            ) : (
              <>
                {chat.isForwarded && (
                  <Ionicons name="arrow-redo" size={13} color={c.textFaint} style={{ marginRight: 2, flexShrink: 0 }} />
                )}
                <Text numberOfLines={1} style={[styles.preview, unread > 0 && styles.previewBright]}>
                  {preview || t('chat.tapToStart')}
                </Text>
              </>
            )}
            {muted && <Ionicons name="volume-mute" size={14} color={c.textFaint} style={styles.muteIcon} />}
            {unread > 0 && (
              <View style={[styles.badge, muted && styles.badgeMuted]}>
                <Text style={[styles.badgeText, muted && styles.badgeTextMuted]}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  // Aurora Glass: each conversation is a floating, rounded glass card with a
  // hairline border — separation comes from depth + spacing, not list dividers.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 3.5,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.stroke,
    gap: 13,
    overflow: 'hidden',
  },
  rowPressed: { backgroundColor: c.surface2, borderColor: c.stroke2 },
  rowSelected: { backgroundColor: c.accentSoft, borderColor: c.accent },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.stroke2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  // Accent edge that the rounded card clips into a soft pill — marks unread.
  unreadBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    backgroundColor: c.accent,
  },
  body: { flex: 1, gap: 5 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  pinIcon: { transform: [{ rotate: '45deg' }] },
  name: {
    flexShrink: 1,
    color: c.text,
    fontFamily: font.bodySemi,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  nameBold: { fontFamily: font.bodyBold },
  time: {
    color: c.textFaint,
    fontFamily: font.mono,
    fontSize: 11.5,
    flexShrink: 0,
  },
  timeAccent: { color: c.accent },
  preview: {
    flex: 1,
    color: c.textFaint,
    fontFamily: font.body,
    fontSize: 14,
  },
  previewBright: { color: c.textDim, fontFamily: font.bodyMed },
  draftLabel: { color: c.danger, fontFamily: font.bodyMed, fontSize: 14 },
  draftText: { color: c.textDim, fontFamily: font.body, fontSize: 14 },
  muteIcon: { flexShrink: 0 },
  badge: {
    minWidth: 22, height: 22,
    borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: c.accent,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    // Soft indigo glow so the unread badge reads as the brightest point in the row.
    shadowColor: c.accent,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  badgeMuted: { backgroundColor: c.surface2, shadowOpacity: 0, elevation: 0 },
  badgeText: { color: c.ink, fontFamily: font.bodyBold, fontSize: 11 },
  badgeTextMuted: { color: c.textDim },

  actionsRow: { flexDirection: 'row', alignItems: 'stretch' },
  // Each action keeps a BTN_W-wide slot (so the swipe reveal math stays exact),
  // but the visible pill is inset with margins + rounded to match the chat row.
  action: {
    width: BTN_W - 6, marginHorizontal: 3, marginVertical: 3.5,
    borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  actionLabel: { color: '#fff', fontFamily: font.bodySemi, fontSize: 11 },
});
