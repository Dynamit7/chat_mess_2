import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { useCall } from '@/state/call';
import { getWebRTC } from '@/lib/webrtc';
import { colors, font } from '@/theme/theme';

export default function CallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name: string; avatar: string; video: string }>();
  const call = useCall();
  const rtc = getWebRTC();
  const RTCView = rtc?.RTCView;

  const peerName = call.peer?.name || params.name || 'Unknown';
  const peerAvatar = call.peer?.avatar || params.avatar || '';
  const { status, isVideo, muted, camOff, speaker, localStream, remoteStream } = call;

  const [timer, setTimer] = useState('00:00');
  const elapsed = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Duration timer runs while connected.
  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => {
        elapsed.current += 1;
        const m = Math.floor(elapsed.current / 60).toString().padStart(2, '0');
        const s = (elapsed.current % 60).toString().padStart(2, '0');
        setTimer(`${m}:${s}`);
      }, 1000);
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [status]);

  // When the call ends (context cleaned up), leave the screen.
  useEffect(() => {
    if (status === 'idle') {
      const t = setTimeout(() => { if (router.canGoBack()) router.back(); }, 250);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  const hangUp = () => { call.endCall(); if (router.canGoBack()) router.back(); };

  const statusText =
    status === 'calling' ? 'Calling…'
    : status === 'connecting' ? 'Connecting…'
    : status === 'connected' ? timer
    : 'Call ended';

  const showRemoteVideo = isVideo && remoteStream && RTCView && status === 'connected';
  const showLocalVideo = isVideo && localStream && !camOff && RTCView;

  return (
    <View style={[styles.full, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}>
      {showRemoteVideo ? (
        <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <LinearGradient
          colors={['rgba(15,12,41,1)', 'rgba(48,43,99,1)', 'rgba(36,36,62,1)']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Local camera preview (PiP) */}
      {showLocalVideo ? (
        <View style={[styles.pip, { top: insets.top + 70 }]}>
          <RTCView streamURL={localStream.toURL()} style={styles.pipVideo} objectFit="cover" mirror zOrder={1} />
        </View>
      ) : null}

      <View style={styles.top}>
        <Pressable hitSlop={10} onPress={hangUp}>
          <Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <Text style={styles.title}>{isVideo ? 'Video Call' : 'Voice Call'}</Text>
        <View style={{ width: 28 }} />
      </View>

      {!showRemoteVideo ? (
        <View style={styles.callerWrap}>
          <Avatar name={peerName} src={peerAvatar} size={130} ring />
          <Text style={styles.callerName}>{peerName}</Text>
          <Text style={[styles.status, status === 'connected' && { color: colors.online }]}>{statusText}</Text>
          {call.error ? <Text style={styles.error}>{call.error}</Text> : null}
        </View>
      ) : (
        <View style={styles.videoTopName}>
          <Text style={styles.videoName}>{peerName}</Text>
          <Text style={styles.videoTimer}>{statusText}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <ControlBtn icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} onPress={call.toggleMute} active={muted} />

        {isVideo ? (
          <>
            <ControlBtn icon={camOff ? 'videocam-off' : 'videocam'} label={camOff ? 'Cam on' : 'Cam off'} onPress={call.toggleCam} active={camOff} />
            <ControlBtn icon="camera-reverse" label="Flip" onPress={call.switchCamera} />
          </>
        ) : (
          <ControlBtn icon={speaker ? 'volume-high' : 'volume-medium'} label="Speaker" onPress={call.toggleSpeaker} active={speaker} />
        )}

        <Pressable onPress={hangUp}>
          <LinearGradient colors={['#e53e3e', '#c53030']} style={styles.endBtn}>
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function ControlBtn({ icon, label, onPress, active }: { icon: any; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.ctrl}>
      <View style={[styles.ctrlInner, active && styles.ctrlActive]}>
        <Ionicons name={icon} size={24} color={active ? colors.ink : '#fff'} />
      </View>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20 },
  title: { color: 'rgba(255,255,255,0.85)', fontFamily: font.bodyMed, fontSize: 16 },
  callerWrap: { alignItems: 'center', gap: 16, paddingHorizontal: 30 },
  callerName: { color: '#fff', fontFamily: font.display, fontSize: 34, letterSpacing: -0.5, textAlign: 'center' },
  status: { color: 'rgba(255,255,255,0.55)', fontFamily: font.body, fontSize: 15 },
  error: { color: '#fca5a5', fontFamily: font.body, fontSize: 13.5, textAlign: 'center', marginTop: 6 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  endBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  ctrl: { alignItems: 'center', gap: 8 },
  ctrlInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  ctrlActive: { backgroundColor: 'rgba(167,139,250,0.9)' },
  ctrlLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: font.bodyMed, fontSize: 12 },
  pip: { position: 'absolute', right: 16, width: 104, height: 150, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', zIndex: 10 },
  pipVideo: { flex: 1 },
  videoTopName: { alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16 },
  videoName: { color: '#fff', fontFamily: font.display, fontSize: 22 },
  videoTimer: { color: 'rgba(255,255,255,0.7)', fontFamily: font.body, fontSize: 14 },
});
