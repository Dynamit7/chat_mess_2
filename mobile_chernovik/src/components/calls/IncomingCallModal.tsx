import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Vibration } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { colors, font, gradients } from '@/theme/theme';

type IncomingCall = {
  callerId: number;
  callerName: string;
  callerPicture?: string;
  isVideo?: boolean;
};

type Props = {
  call: IncomingCall | null;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingCallModal({ call, onAccept, onDecline }: Props) {
  const insets = useSafeAreaInsets();
  const vibrating = useRef(false);

  useEffect(() => {
    if (call && !vibrating.current) {
      vibrating.current = true;
      Vibration.vibrate([400, 300, 400, 300, 400], true);
    } else if (!call) {
      vibrating.current = false;
      Vibration.cancel();
    }
    return () => {
      if (vibrating.current) { Vibration.cancel(); vibrating.current = false; }
    };
  }, [!!call]);

  if (!call) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDecline} statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}>
        <LinearGradient
          colors={['rgba(15,12,41,0.96)', 'rgba(48,43,99,0.96)', 'rgba(36,36,62,0.98)']}
          style={StyleSheet.absoluteFill}
        />

        <Text style={styles.label}>{call.isVideo ? 'Incoming Video Call' : 'Incoming Call'}</Text>

        <View style={styles.callerWrap}>
          <Avatar name={call.callerName} src={call.callerPicture} size={120} ring />
          <Text style={styles.callerName}>{call.callerName}</Text>
          <Text style={styles.callerSub}>is calling you…</Text>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onDecline} style={styles.btn}>
            <LinearGradient colors={['#e53e3e', '#c53030']} style={styles.btnInner}>
              <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </LinearGradient>
            <Text style={styles.btnLabel}>Decline</Text>
          </Pressable>

          <Pressable onPress={onAccept} style={styles.btn}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnInner}>
              <Ionicons name={call.isVideo ? 'videocam' : 'call'} size={32} color={colors.ink} />
            </LinearGradient>
            <Text style={styles.btnLabel}>Accept</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  label: { color: 'rgba(255,255,255,0.7)', fontFamily: font.bodyMed, fontSize: 14, letterSpacing: 0.5 },
  callerWrap: { alignItems: 'center', gap: 14 },
  callerName: { color: '#fff', fontFamily: font.display, fontSize: 32, letterSpacing: -0.5 },
  callerSub: { color: 'rgba(255,255,255,0.55)', fontFamily: font.body, fontSize: 15 },
  actions: { flexDirection: 'row', gap: 60, alignItems: 'center' },
  btn: { alignItems: 'center', gap: 10 },
  btnInner: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  btnLabel: { color: 'rgba(255,255,255,0.8)', fontFamily: font.bodyMed, fontSize: 13 },
});
