import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { colors, font } from '@/theme/theme';

const fmt = (s: number) => {
  const sec = Math.max(0, Math.floor(s));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** Inline voice-note player: play/pause, progress track and elapsed/total time. */
export function VoiceMessage({ uri, isOut }: { uri: string; isOut: boolean }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const playing = status.playing;
  const duration = status.duration || 0;
  const position = status.currentTime || 0;
  const pct = duration > 0 ? Math.min(position / duration, 1) : 0;

  const toggle = async () => {
    if (playing) { player.pause(); return; }
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    if (status.didJustFinish || (duration > 0 && position >= duration - 0.05)) {
      await player.seekTo(0).catch(() => {});
    }
    player.play();
  };

  const fg = isOut ? colors.white : colors.accent;
  const track = isOut ? 'rgba(255,255,255,0.3)' : colors.stroke2;

  return (
    <Pressable onPress={toggle} style={styles.row}>
      <View style={[styles.btn, { backgroundColor: isOut ? 'rgba(255,255,255,0.18)' : colors.accentSoft }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={fg} />
      </View>
      <View style={styles.body}>
        <View style={[styles.track, { backgroundColor: track }]}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: fg }]} />
        </View>
        <Text style={[styles.time, { color: isOut ? 'rgba(255,255,255,0.72)' : colors.textFaint }]}>
          {fmt(playing || position > 0 ? position : duration)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingRight: 6, minWidth: 168 },
  btn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 5 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  time: { fontFamily: font.mono, fontSize: 11 },
});
