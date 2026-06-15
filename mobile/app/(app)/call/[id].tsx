import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/state/auth';
import { useSocket } from '@/state/socket';
import { colors, font, gradients } from '@/theme/theme';

type CallState = 'calling' | 'connected' | 'ended';

export default function CallScreen() {
  const { user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; name: string; avatar: string; incoming: string }>();
  const me = Number(user?.userId);
  const peerId = Number(params.id);
  const peerName = params.name || 'Unknown';
  const isIncoming = params.incoming === 'true';

  const [callState, setCallState] = useState<CallState>(isIncoming ? 'connected' : 'calling');
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const elapsed = useRef(0);
  const [timer, setTimer] = useState('00:00');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start duration timer when call connects
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        elapsed.current += 1;
        const m = Math.floor(elapsed.current / 60).toString().padStart(2, '0');
        const s = (elapsed.current % 60).toString().padStart(2, '0');
        setTimer(`${m}:${s}`);
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  // Socket events
  useEffect(() => {
    const onAccepted = () => setCallState('connected');
    const onDeclined = () => { setCallState('ended'); setTimeout(() => router.back(), 1200); };
    const onEnded = () => { setCallState('ended'); setTimeout(() => router.back(), 1200); };

    socket.on('callAccepted', onAccepted);
    socket.on('callDeclined', onDeclined);
    socket.on('callEnded', onEnded);
    return () => {
      socket.off('callAccepted', onAccepted);
      socket.off('callDeclined', onDeclined);
      socket.off('callEnded', onEnded);
    };
  }, [socket, router]);

  // Emit callUser when dialing out
  useEffect(() => {
    if (!isIncoming) {
      socket.emit('callUser', {
        to: peerId,
        callerId: me,
        callerName: user?.username || 'User',
        callerPicture: user?.avatar || '',
      });
    }
  }, []);

  const hangUp = () => {
    socket.emit('endCall', { to: peerId });
    setCallState('ended');
    setTimeout(() => router.back(), 600);
  };

  const statusText =
    callState === 'calling' ? 'Calling…'
    : callState === 'connected' ? timer
    : 'Call ended';

  return (
    <View style={[styles.full, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}>
      <LinearGradient
        colors={['rgba(15,12,41,1)', 'rgba(48,43,99,1)', 'rgba(36,36,62,1)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.top}>
        <Pressable hitSlop={10} onPress={hangUp}>
          <Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <Text style={styles.title}>{callState === 'calling' ? 'Calling' : 'Voice Call'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.callerWrap}>
        <Avatar name={peerName} src={params.avatar} size={130} ring />
        <Text style={styles.callerName}>{peerName}</Text>
        <Text style={[styles.status, callState === 'connected' && { color: colors.online }]}>{statusText}</Text>
      </View>

      {callState !== 'ended' ? (
        <View style={styles.controls}>
          <ControlBtn icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Unmute' : 'Mute'} onPress={() => setMuted((m) => !m)} active={muted} />
          <Pressable onPress={hangUp}>
            <LinearGradient colors={['#e53e3e', '#c53030']} style={styles.endBtn}>
              <Ionicons name="call" size={34} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </LinearGradient>
          </Pressable>
          <ControlBtn icon={speaker ? 'volume-high' : 'volume-medium'} label="Speaker" onPress={() => setSpeaker((s) => !s)} active={speaker} />
        </View>
      ) : (
        <View style={styles.endedRow}>
          <Text style={styles.endedText}>Call ended</Text>
        </View>
      )}
    </View>
  );
}

function ControlBtn({ icon, label, onPress, active }: { icon: any; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.ctrl}>
      <View style={[styles.ctrlInner, active && styles.ctrlActive]}>
        <Ionicons name={icon} size={26} color={active ? colors.ink : '#fff'} />
      </View>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20 },
  title: { color: 'rgba(255,255,255,0.85)', fontFamily: font.bodyMed, fontSize: 16 },
  callerWrap: { alignItems: 'center', gap: 16 },
  callerName: { color: '#fff', fontFamily: font.display, fontSize: 34, letterSpacing: -0.5 },
  status: { color: 'rgba(255,255,255,0.55)', fontFamily: font.body, fontSize: 15 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  endBtn: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  ctrl: { alignItems: 'center', gap: 8 },
  ctrlInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  ctrlActive: { backgroundColor: 'rgba(167,139,250,0.85)' },
  ctrlLabel: { color: 'rgba(255,255,255,0.6)', fontFamily: font.bodyMed, fontSize: 12 },
  endedRow: { alignItems: 'center' },
  endedText: { color: 'rgba(255,255,255,0.5)', fontFamily: font.body, fontSize: 15 },
});
