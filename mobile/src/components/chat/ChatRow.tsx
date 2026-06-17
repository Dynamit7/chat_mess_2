import { useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui/Avatar';
import { colors, font, Palette } from '@/theme/theme';
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
          <Text style={styles.actionLabel}>{muted ? 'Вкл. звук' : 'Без звука'}</Text>
        </Pressable>
      )}
      {onPin && (
        <Pressable style={[styles.action, { backgroundColor: c.pin }]} onPress={handle(onPin)}>
          <Ionicons name={pinned ? 'pin-outline' : 'pin'} size={22} color="#fff" />
          <Text style={styles.actionLabel}>{pinned ? 'Открепить' : 'Закрепить'}</Text>
        </Pressable>
      )}
      {onDelete && (
        <Pressable style={[styles.action, { backgroundColor: c.danger }]} onPress={handle(onDelete)}>
          <Ionicons name="trash" size={22} color="#fff" />
          <Text style={styles.actionLabel}>Удалить</Text>
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
          <Avatar name={chat.username} src={chat.picture} size={56} online={online} palette={c} />
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
                <Text style={styles.draftLabel}>Черновик: </Text>
                <Text style={styles.draftText}>{draft}</Text>
              </Text>
            ) : (
              <>
                {chat.isForwarded && (
                  <Ionicons name="arrow-redo" size={13} color={c.textFaint} style={{ marginRight: 2, flexShrink: 0 }} />
                )}
                <Text numberOfLines={1} style={[styles.preview, unread > 0 && styles.previewBright]}>
                  {preview || 'Нажмите, чтобы начать чат'}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    gap: 14,
  },
  rowPressed: { backgroundColor: c.glass },
  rowSelected: { backgroundColor: c.glass2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.stroke2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  unreadBar: {
    position: 'absolute',
    left: 0, top: 16, bottom: 16,
    width: 3, borderRadius: 3,
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
  },
  badgeMuted: { backgroundColor: c.surface2 },
  badgeText: { color: c.ink, fontFamily: font.bodyBold, fontSize: 11 },
  badgeTextMuted: { color: c.textDim },

  actionsRow: { flexDirection: 'row', alignItems: 'stretch' },
  action: { width: BTN_W, alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionLabel: { color: '#fff', fontFamily: font.bodySemi, fontSize: 11 },
});
