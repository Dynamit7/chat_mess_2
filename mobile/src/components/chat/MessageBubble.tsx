import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, gradients, Palette } from '@/theme/theme';
import { timeOf } from '@/lib/format';
import { fixFileUrl } from '@/lib/config';
import { SwipeToReply } from '@/components/chat/SwipeToReply';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { useT } from '@/i18n';
import type { Message } from '@/lib/api';

type Props = {
  msg: Message;
  isOut: boolean;
  grouped: boolean;
  me: number;
  onLongPress: (m: Message) => void;
  onImagePress?: (uri: string) => void;
  /** Tap an existing reaction chip to toggle your own reaction of that emoji (Telegram-style). */
  onReactToggle?: (m: Message, emoji: string) => void;
  /** Tap a failed (unsent) message to retry / discard it. */
  onRetry?: (m: Message) => void;
  /** Swipe a message to the right to reply to it (Telegram-style). */
  onReply?: (m: Message) => void;
  /** Long-press a reaction chip to see who reacted. */
  onShowReactors?: (m: Message) => void;
  /** Incoming sender label (groups). Shown above the bubble when not grouped. */
  senderName?: string;
  /** Own username — used to show "Вы" on outgoing forwarded messages. */
  myUsername?: string;
  /** Multi-select state. When active, tapping toggles selection instead of opening media. */
  selectionMode?: boolean;
  selected?: boolean;
  /** Whether this message may be picked (only deletable ones). */
  selectable?: boolean;
  onToggleSelect?: (m: Message) => void;
  palette?: Palette;
};

// Stable-ish colour for a sender label in group chats.
const NAME_COLORS = ['#c84b4b', '#5b8def', '#36d3c0', '#f58bb0', '#f7c66b', '#e0568b', '#4f8cff', '#e08bcf'];
function nameColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

/** Read-state ticks. On violet bubbles they sit in white; read state turns solid white. */
function Ticks({ msg, c }: { msg: Message; c: Palette }) {
  const dim = 'rgba(255,255,255,0.6)';
  const solid = 'rgba(255,255,255,0.98)';
  if (msg.status === 'sending') return <Ionicons name="time-outline" size={12} color={dim} />;
  if (msg.status === 'failed') return <Ionicons name="alert-circle" size={12} color={c.danger} />;
  if (msg.isRead) return <Ionicons name="checkmark-done" size={14} color={solid} />;
  if (msg.isDelivered) return <Ionicons name="checkmark-done" size={14} color={dim} />;
  return <Ionicons name="checkmark" size={14} color={dim} />;
}

export function MessageBubble({ msg, isOut, grouped, me, onLongPress, onImagePress, onReactToggle, onRetry, onReply, onShowReactors, senderName, myUsername, selectionMode, selected, selectable, onToggleSelect, palette = colors }: Props) {
  const c = palette;
  const { t } = useT();
  const styles = useMemo(() => makeStyles(c), [c]);
  const hasText = !!(msg.text && msg.text.trim());
  const isImage = msg.type === 'image' && !!msg.fileUrl;
  const isAudio = msg.type === 'audio' && !!msg.fileUrl;
  const isFile = (msg.type === 'file' || msg.type === 'video') && !!msg.fileUrl;

  // Aggregate reactions by emoji: { '👍': { count, mine } }
  const agg: Record<string, { count: number; mine: boolean }> = {};
  for (const r of msg.reactions || []) {
    const cur = agg[r.emoji] || { count: 0, mine: false };
    cur.count += 1;
    if (Number(r.userId) === me) cur.mine = true;
    agg[r.emoji] = cur;
  }
  const reactionList = Object.entries(agg);

  const metaColor = isOut ? 'rgba(255,255,255,0.72)' : c.textFaint;

  const bubbleStyle = [
    styles.bubble,
    isOut ? styles.bubbleOut : styles.bubbleIn,
    grouped && (isOut ? styles.groupedOut : styles.groupedIn),
    isImage && styles.bubbleMedia,
  ];

  const bubbleContent = (
    <>
      {senderName && !isOut ? (
        <Text style={[styles.sender, { color: nameColor(senderName) }]} numberOfLines={1}>{senderName}</Text>
      ) : null}
      {msg.forwardedFromUsername ? (
        <View style={[styles.forwardBanner, isOut && styles.forwardBannerOut]}>
          <Ionicons name="arrow-redo" size={12} color={isOut ? 'rgba(255,255,255,0.75)' : c.accent} />
          <Text style={[styles.forwardText, isOut && { color: 'rgba(255,255,255,0.75)' }]} numberOfLines={1}>
            {isOut && myUsername && msg.forwardedFromUsername === myUsername ? t('feed.you') : msg.forwardedFromUsername}
          </Text>
        </View>
      ) : null}
      {msg.replyTo ? (
        <View style={[styles.reply, isOut ? styles.replyOut : styles.replyIn]}>
          <Text numberOfLines={1} style={[styles.replyText, isOut && { color: 'rgba(255,255,255,0.85)' }]}>
            {msg.replyTo.text || 'Attachment'}
          </Text>
        </View>
      ) : null}

      {isImage ? (
        <Pressable onPress={() => onImagePress?.(fixFileUrl(msg.fileUrl))}>
          <Image source={{ uri: fixFileUrl(msg.fileUrl) }} style={styles.image} contentFit="cover" transition={0} />
        </Pressable>
      ) : null}

      {isAudio ? <VoiceMessage uri={fixFileUrl(msg.fileUrl)} isOut={isOut} /> : null}

      {isFile ? (
        <View style={styles.fileRow}>
          <View style={[styles.fileIcon, { backgroundColor: isOut ? 'rgba(255,255,255,0.18)' : c.accentSoft }]}>
            <Ionicons
              name={msg.type === 'video' ? 'play' : 'document'}
              size={18}
              color={isOut ? c.white : c.accent}
            />
          </View>
          <Text numberOfLines={1} style={[styles.fileName, isOut && { color: c.white }]}>{msg.filename || 'Attachment'}</Text>
        </View>
      ) : null}

      {hasText ? <Text style={[styles.text, isOut ? styles.textOut : styles.textIn]}>{msg.text}</Text> : null}

      <View style={styles.meta}>
        {msg.isEdited ? <Text style={[styles.edited, { color: metaColor }]}>edited</Text> : null}
        <Text style={[styles.time, { color: metaColor }]}>{timeOf(msg.createdAt)}</Text>
        {isOut ? <Ticks msg={msg} c={c} /> : null}
      </View>
    </>
  );

  const body = (
    <View style={[styles.rowWrap, { alignItems: isOut ? 'flex-end' : 'flex-start', marginTop: grouped ? 2 : 10 }]}>
      <Pressable
        onPress={msg.status === 'failed' && onRetry ? () => onRetry(msg) : undefined}
        onLongPress={() => onLongPress(msg)}
        delayLongPress={220}
        style={({ pressed }) => ({ maxWidth: '82%', opacity: pressed ? 0.94 : 1 })}
      >
        {isOut ? (
          <LinearGradient colors={gradients.bubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={bubbleStyle}>
            {bubbleContent}
          </LinearGradient>
        ) : (
          <View style={bubbleStyle}>{bubbleContent}</View>
        )}
      </Pressable>

      {reactionList.length > 0 ? (
        <View style={[styles.reactions, { justifyContent: isOut ? 'flex-end' : 'flex-start' }]}>
          {reactionList.map(([emoji, info]) => (
            <Pressable
              key={emoji}
              onPress={() => (onReactToggle ? onReactToggle(msg, emoji) : onLongPress(msg))}
              onLongPress={() => (onShowReactors ? onShowReactors(msg) : onLongPress(msg))}
              style={[styles.reactionChip, info.mine && styles.reactionChipMine]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              {info.count > 1 ? <Text style={[styles.reactionCount, info.mine && { color: c.accent }]}>{info.count}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (selectionMode) {
    return (
      <Pressable
        onPress={() => selectable && onToggleSelect?.(msg)}
        style={[styles.selectRow, selected && styles.selectRowOn]}
      >
        <View style={[styles.checkbox, selected && styles.checkboxOn, !selectable && styles.checkboxHidden]}>
          {selected ? <Ionicons name="checkmark" size={14} color={c.ink} /> : null}
        </View>
        <View style={{ flex: 1 }} pointerEvents="none">{body}</View>
      </Pressable>
    );
  }

  if (onReply && msg.status !== 'sending' && msg.status !== 'failed') {
    return (
      <SwipeToReply onReply={() => onReply(msg)} alignRight={isOut}>
        {body}
      </SwipeToReply>
    );
  }

  return body;
}

const makeStyles = (c: Palette) => StyleSheet.create({
  rowWrap: { paddingHorizontal: 14 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.xl },
  bubbleMedia: { padding: 4, paddingBottom: 6 },
  // Outgoing: emerald→teal gradient (fill comes from LinearGradient), white text, sharp bottom-right tail.
  bubbleOut: {
    borderBottomRightRadius: 6,
    // Soft teal glow lifts the outgoing bubble off the canvas — the Aurora Glass signature.
    shadowColor: c.brand2,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Incoming: quiet glass surface, hairline border, sharp bottom-left tail.
  bubbleIn: { backgroundColor: c.bubbleIn, borderWidth: 1, borderColor: c.stroke2, borderBottomLeftRadius: 6 },
  groupedOut: { borderTopRightRadius: radius.xl, borderBottomRightRadius: 6 },
  groupedIn: { borderTopLeftRadius: radius.xl, borderBottomLeftRadius: 6 },
  sender: { fontFamily: font.bodySemi, fontSize: 12.5, marginBottom: 2 },
  text: { fontFamily: font.body, fontSize: 15.5, lineHeight: 21 },
  textOut: { color: c.white },
  textIn: { color: c.text },
  meta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 5, marginTop: 3 },
  time: { fontFamily: font.mono, fontSize: 10.5, letterSpacing: 0.2 },
  edited: { fontFamily: font.mono, fontSize: 10.5, fontStyle: 'italic' },
  image: { width: 232, height: 232, borderRadius: 13, backgroundColor: c.glass },
  forwardBanner: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  forwardBannerOut: {},
  forwardText: { color: c.accent, fontFamily: font.bodyMed, fontSize: 12, fontStyle: 'italic', flexShrink: 1 },
  reply: { borderLeftWidth: 2, paddingLeft: 8, paddingVertical: 3, marginBottom: 5 },
  replyOut: { borderLeftColor: 'rgba(255,255,255,0.7)' },
  replyIn: { borderLeftColor: c.accent },
  replyText: { color: c.textDim, fontFamily: font.body, fontSize: 13 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingRight: 8, minWidth: 180 },
  fileIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  fileName: { flex: 1, color: c.text, fontFamily: font.bodyMed, fontSize: 14 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5, maxWidth: '82%' },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: c.glass2, borderRadius: radius.full, borderWidth: 1, borderColor: c.stroke,
  },
  reactionChipMine: { backgroundColor: c.accentSoft, borderColor: c.accent },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { color: c.textDim, fontFamily: font.bodySemi, fontSize: 12 },

  selectRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  selectRowOn: { backgroundColor: c.glass },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.stroke2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkboxHidden: { opacity: 0 },
});
