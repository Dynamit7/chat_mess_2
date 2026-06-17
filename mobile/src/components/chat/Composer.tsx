import { useRef, useState, useEffect, useMemo } from 'react';
import { View, TextInput, Pressable, StyleSheet, Text, Alert, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { getDraft, writeDraft, commitDraft } from '@/lib/drafts';
import { font, radius, gradients, shadow, Palette } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeContext';
import type { Message } from '@/lib/api';

const fmtMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function Composer({
  replyTo,
  editing,
  draftKey,
  onCancelReply,
  onCancelEdit,
  onSend,
  onSaveEdit,
  onAttach,
  onSendAudio,
  onTyping,
}: {
  replyTo: Message | null;
  editing: Message | null;
  /** Per-conversation key to persist the unsent message. Null disables drafts. */
  draftKey?: string | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (text: string) => void;
  onSaveEdit: (text: string) => void;
  onAttach: () => void;
  /** Send a recorded voice note. Omit to hide the mic button. */
  onSendAudio?: (asset: { uri: string; name?: string; mime?: string }) => void;
  onTyping: (isTyping: boolean) => void;
}) {
  const { c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const typingRef = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef('');
  textRef.current = text;

  useEffect(() => {
    if (editing) {
      setText(editing.text || '');
      inputRef.current?.focus();
    }
  }, [editing]);

  // Load a saved draft when entering the conversation; flush it back on exit so
  // nothing typed is ever lost between visits (and the list shows "Черновик: …").
  useEffect(() => {
    if (!draftKey) return;
    let alive = true;
    getDraft(draftKey).then((saved) => {
      if (alive && saved && !editing) setText(saved);
    });
    return () => {
      alive = false;
      commitDraft(draftKey, textRef.current);
    };
  }, [draftKey]);

  const saveDraft = (val: string) => {
    if (!draftKey || editing) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => writeDraft(draftKey, val), 350);
  };

  // ── Voice recording (hold the mic to record, release to send) ──────────────
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const [recording, setRecording] = useState(false);
  const startedRef = useRef(false);   // record() actually began
  const releasedRef = useRef(false);  // finger lifted before start completed
  const startMs = useRef(0);

  const startRecording = async () => {
    releasedRef.current = false;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert('Микрофон', 'Разрешите доступ к микрофону, чтобы записывать голосовые сообщения.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (releasedRef.current) { releasedRef.current = false; return; } // released during prepare
      recorder.record();
      startMs.current = Date.now();
      startedRef.current = true;
      setRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      setRecording(false);
    }
  };

  const finishRecording = async (send: boolean) => {
    if (!startedRef.current) { releasedRef.current = true; return; } // start still pending → abort it
    startedRef.current = false;
    setRecording(false);
    const ms = Date.now() - startMs.current;
    try { await recorder.stop(); } catch {}
    const uri = recorder.uri;
    if (send && uri && ms >= 700) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onSendAudio?.({ uri, name: `voice_${Date.now()}.m4a`, mime: 'audio/m4a' });
    }
  };

  const emitTyping = (val: string) => {
    setText(val);
    saveDraft(val);
    if (editing) return;
    if (val && !typingRef.current) {
      typingRef.current = true;
      onTyping(true);
    }
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      typingRef.current = false;
      onTyping(false);
    }, 1800);
  };

  const toggleEmoji = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      setEmojiOpen(true);
    }
  };

  const insertEmoji = (emoji: string) => {
    Haptics.selectionAsync().catch(() => {});
    emitTyping(textRef.current + emoji);
  };

  const backspaceEmoji = () => {
    // Drop the last visible character (handles surrogate-pair emoji).
    const chars = Array.from(textRef.current);
    emitTyping(chars.slice(0, -1).join(''));
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (editing) onSaveEdit(t);
    else onSend(t);
    setText('');
    setEmojiOpen(false);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (draftKey) commitDraft(draftKey, '');
    typingRef.current = false;
    onTyping(false);
  };

  const banner = editing
    ? { title: 'Editing message', text: editing.text || '', onCancel: () => { onCancelEdit(); setText(''); } }
    : replyTo
    ? { title: 'Replying', text: replyTo.text || 'Attachment', onCancel: onCancelReply }
    : null;

  return (
    <View style={styles.wrap}>
      {banner ? (
        <View style={styles.banner}>
          <View style={styles.bannerBar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text numberOfLines={1} style={styles.bannerText}>{banner.text}</Text>
          </View>
          <Pressable hitSlop={8} onPress={banner.onCancel}>
            <Ionicons name="close" size={20} color={c.textDim} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        {recording ? (
          <View style={styles.recBar}>
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{fmtMs(recState.durationMillis || 0)}</Text>
            <Text numberOfLines={1} style={styles.recHint}>Отпустите для отправки</Text>
          </View>
        ) : (
          <>
            {!editing ? (
              <Pressable onPress={onAttach} style={styles.attach} hitSlop={6}>
                <Ionicons name="add" size={26} color={c.accent} />
              </Pressable>
            ) : null}
            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={emitTyping}
                onFocus={() => setEmojiOpen(false)}
                placeholder="Сообщение"
                placeholderTextColor={c.textFaint}
                style={styles.input}
                multiline
              />
              <Pressable onPress={toggleEmoji} hitSlop={6} style={styles.emojiBtn}>
                <Ionicons
                  name={emojiOpen ? 'chevron-down-outline' : 'happy-outline'}
                  size={24}
                  color={emojiOpen ? c.accent : c.textFaint}
                />
              </Pressable>
            </View>
          </>
        )}

        {(!!onSendAudio && !editing && !text.trim()) || recording ? (
          <Pressable onPressIn={startRecording} onPressOut={() => finishRecording(true)} hitSlop={4}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.send, recording && styles.sendRec]}>
              <Ionicons name="mic" size={22} color={c.ink} />
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable onPress={submit} disabled={!text.trim()} style={{ opacity: text.trim() ? 1 : 0.4 }}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.send, text.trim() ? shadow.glow : null]}>
              <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={22} color={c.ink} />
            </LinearGradient>
          </Pressable>
        )}
      </View>

      {emojiOpen && !recording ? (
        <View style={styles.emojiPanel}>
          <EmojiPicker onPick={insertEmoji} onBackspace={backspaceEmoji} />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.glass, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: c.stroke },
  bannerBar: { width: 3, height: 32, borderRadius: 2, backgroundColor: c.accent },
  bannerTitle: { color: c.accent, fontFamily: font.bodySemi, fontSize: 12 },
  bannerText: { color: c.textDim, fontFamily: font.body, fontSize: 13, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attach: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.glass2, borderWidth: 1, borderColor: c.stroke,
    alignItems: 'center', justifyContent: 'center',
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke, borderRadius: radius.lg,
    paddingLeft: 16, paddingRight: 6, minHeight: 44, maxHeight: 130,
  },
  input: { flex: 1, color: c.text, fontFamily: font.body, fontSize: 16, paddingVertical: 10 },
  emojiBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emojiPanel: { marginHorizontal: -12 },
  send: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sendRec: { transform: [{ scale: 1.12 }] },
  recBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.glass, borderWidth: 1, borderColor: c.stroke, borderRadius: radius.lg,
    paddingHorizontal: 16, minHeight: 44,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger },
  recTime: { color: c.text, fontFamily: font.mono, fontSize: 14 },
  recHint: { flex: 1, color: c.textFaint, fontFamily: font.body, fontSize: 13, textAlign: 'right' },
});

