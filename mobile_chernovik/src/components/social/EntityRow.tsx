import { useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Avatar } from '@/components/ui/Avatar';
import { useT } from '@/i18n';
import { colors, font, gradients, Palette } from '@/theme/theme';
import { relativeShort, previewOf } from '@/lib/format';

const BTN_W = 80;

export type Entity = {
  id: number;
  name: string;
  avatar?: string | null;
  description?: string;
  isPublic?: boolean;
  membersCount?: number;
  subscribersCount?: number;
  lastMessage?: string;
  lastMessageType?: string;
  lastMessageSender?: string;
  lastMessageTime?: string;
  lastMessageIsForwarded?: boolean;
  unreadCount?: number;
};

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

/** A group/channel row: avatar, name, last message preview, time + unread badge. */
export function EntityRow({
  entity,
  kind,
  onPress,
  muted,
  pinned,
  onMute,
  onPin,
  onDelete,
  onLongPress,
  selectionMode,
  selected,
  draft,
  palette = colors,
}: {
  entity: Entity;
  kind: 'group' | 'channel';
  onPress: () => void;
  muted?: boolean;
  pinned?: boolean;
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
  const unread = entity.unreadCount || 0;
  const count = entity.membersCount ?? entity.subscribersCount;
  const preview = entity.lastMessage
    ? `${entity.lastMessageSender ? entity.lastMessageSender + ': ' : ''}${previewOf(entity.lastMessage, entity.lastMessageType)}`
    : entity.description || (count != null ? t(kind === 'group' ? 'info.members' : 'info.subscribers', { count }) : t('chat.tapToStart'));
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
      >
        {selectionMode && (
          <View style={[styles.checkbox, selected && styles.checkboxOn]}>
            {selected ? <Ionicons name="checkmark" size={15} color={c.ink} /> : null}
          </View>
        )}
        <View>
          <Avatar name={entity.name} src={entity.avatar} size={54} palette={c} />
          <View style={styles.kindDot}>
            <Ionicons name={kind === 'group' ? 'people' : 'megaphone'} size={11} color={c.ink} />
          </View>
        </View>
        <View style={styles.middle}>
          <View style={styles.nameLine}>
            {pinned && <Ionicons name="pin" size={12} color={c.textFaint} style={styles.pinIcon} />}
            <Text numberOfLines={1} style={styles.name}>{entity.name}</Text>
          </View>
          <View style={styles.previewLine}>
            {draft ? (
              <Text numberOfLines={1} style={styles.preview}>
                <Text style={styles.draftLabel}>{t('chat.draft')}: </Text>
                <Text style={styles.draftText}>{draft}</Text>
              </Text>
            ) : (
              <>
                {entity.lastMessageIsForwarded && (
                  <Ionicons name="arrow-redo" size={13} color={c.textFaint} style={{ marginRight: 2 }} />
                )}
                <Text numberOfLines={1} style={[styles.preview, unread > 0 && styles.previewUnread]}>{preview}</Text>
              </>
            )}
            {muted && <Ionicons name="volume-mute" size={14} color={c.textFaint} />}
          </View>
        </View>
        <View style={styles.right}>
          {entity.lastMessageTime ? <Text style={styles.time}>{relativeShort(entity.lastMessageTime)}</Text> : <View style={{ height: 14 }} />}
          {unread > 0 ? (
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </LinearGradient>
          ) : (
            <View style={{ height: 22 }} />
          )}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  // Aurora Glass: floating rounded glass card, matched to the chat list.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    marginHorizontal: 12, marginVertical: 3.5,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 20, backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.stroke,
    overflow: 'hidden',
  },
  rowPressed: { backgroundColor: c.surface2, borderColor: c.stroke2 },
  rowSelected: { backgroundColor: c.accentSoft, borderColor: c.accent },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.stroke2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  kindDot: {
    position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: c.surface,
  },
  middle: { flex: 1, gap: 4 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pinIcon: { transform: [{ rotate: '45deg' }] },
  previewLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flex: 1, color: c.text, fontFamily: font.bodySemi, fontSize: 16 },
  preview: { flex: 1, color: c.textFaint, fontFamily: font.body, fontSize: 14 },
  previewUnread: { color: c.textDim, fontFamily: font.bodyMed },
  draftLabel: { color: c.danger, fontFamily: font.bodyMed, fontSize: 14 },
  draftText: { color: c.textDim, fontFamily: font.body, fontSize: 14 },
  right: { alignItems: 'flex-end', gap: 7, minWidth: 44 },
  time: { color: c.textFaint, fontFamily: font.mono, fontSize: 11 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: c.ink, fontFamily: font.bodyBold, fontSize: 11 },

  actionsRow: { flexDirection: 'row', alignItems: 'stretch' },
  action: { width: 80, alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionLabel: { color: '#fff', fontFamily: font.bodySemi, fontSize: 11 },
});
