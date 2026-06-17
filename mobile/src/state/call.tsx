import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useSocket } from './socket';
import { useAuth } from './auth';
import { getWebRTC, isWebRTCAvailable } from '@/lib/webrtc';
import { callsApi } from '@/lib/api';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connecting' | 'connected';
export type CallPeer = { id: number; name: string; avatar?: string };

type CallContextValue = {
  available: boolean;
  status: CallStatus;
  peer: CallPeer | null;
  isVideo: boolean;
  muted: boolean;
  camOff: boolean;
  speaker: boolean;
  localStream: any | null;
  remoteStream: any | null;
  error: string | null;
  startCall: (peer: CallPeer, opts?: { video?: boolean }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: (silent?: boolean) => void;
  toggleMute: () => void;
  toggleCam: () => void;
  toggleSpeaker: () => void;
  switchCamera: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

const FALLBACK_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function CallProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const { user } = useAuth();
  const me = Number(user?.userId);
  const available = isWebRTCAvailable();

  const [status, setStatus] = useState<CallStatus>('idle');
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<any | null>(null);
  const localRef = useRef<any | null>(null);
  const pendingIce = useRef<any[]>([]);
  const peerIdRef = useRef<number | null>(null);
  const isVideoRef = useRef(false);

  const cleanup = useCallback(() => {
    try { pcRef.current?.close?.(); } catch {}
    pcRef.current = null;
    try { localRef.current?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
    localRef.current = null;
    pendingIce.current = [];
    peerIdRef.current = null;
    isVideoRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('idle');
    setPeer(null);
    setMuted(false);
    setCamOff(false);
    setSpeaker(false);
  }, []);

  // Acquire mic (+ camera for video calls), falling back to audio-only if the
  // camera is missing/busy. Stores the stream and returns it.
  const getMedia = useCallback(async (video: boolean) => {
    const rtc = getWebRTC();
    if (!rtc) throw new Error('webrtc-unavailable');
    const constraints = { audio: true, video: video ? { facingMode: 'user' } : false };
    try {
      const stream = await rtc.mediaDevices.getUserMedia(constraints);
      localRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (e: any) {
      if (video) {
        // Camera unavailable — degrade to an audio call.
        const stream = await rtc.mediaDevices.getUserMedia({ audio: true, video: false });
        localRef.current = stream;
        setLocalStream(stream);
        setIsVideo(false);
        isVideoRef.current = false;
        return stream;
      }
      throw e;
    }
  }, []);

  const fetchIce = useCallback(async () => {
    try {
      const { iceServers } = await callsApi.iceServers();
      return Array.isArray(iceServers) && iceServers.length ? iceServers : FALLBACK_ICE;
    } catch {
      return FALLBACK_ICE;
    }
  }, []);

  const buildPc = useCallback(async (toId: number) => {
    const rtc = getWebRTC();
    const iceServers = await fetchIce();
    const pc = new rtc.RTCPeerConnection({ iceServers });
    localRef.current?.getTracks?.().forEach((t: any) => pc.addTrack(t, localRef.current));
    (pc as any).onicecandidate = (e: any) => {
      if (e.candidate) socket.emit('iceCandidate', { to: toId, candidate: e.candidate });
    };
    (pc as any).ontrack = (e: any) => {
      if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]);
    };
    (pc as any).onconnectionstatechange = () => {
      const st = (pc as any).connectionState;
      if (st === 'connected') setStatus('connected');
      else if (st === 'disconnected' || st === 'failed' || st === 'closed') endCallRef.current(true);
    };
    pcRef.current = pc;
    return pc;
  }, [fetchIce, socket]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIce.current) { try { await pc.addIceCandidate(c); } catch {} }
    pendingIce.current = [];
  }, []);

  // ---- Outgoing ----
  const startCall = useCallback(async (p: CallPeer, opts?: { video?: boolean }) => {
    if (!available) { setError('Звонки доступны только в установленном приложении (не в Expo Go).'); return; }
    if (status !== 'idle') return;
    const video = !!opts?.video;
    try {
      setError(null);
      setIsVideo(video);
      isVideoRef.current = video;
      setPeer(p);
      peerIdRef.current = p.id;
      setStatus('calling');
      await getMedia(video);
      await buildPc(p.id);
      socket.emit('callUser', {
        to: p.id,
        callerId: me,
        callerName: user?.username || 'User',
        callerPicture: user?.avatar || null,
        video,
      });
    } catch (e: any) {
      cleanup();
      setError(mediaError(e));
    }
  }, [available, status, getMedia, buildPc, socket, me, user, cleanup]);

  // ---- Incoming accept/decline ----
  const acceptCall = useCallback(async () => {
    if (peerIdRef.current == null) return;
    try {
      setError(null);
      await getMedia(isVideoRef.current);
      await buildPc(peerIdRef.current);
      setStatus('connecting');
      socket.emit('acceptCall', { to: peerIdRef.current });
    } catch (e: any) {
      setError(mediaError(e));
      declineCallRef.current();
    }
  }, [getMedia, buildPc, socket]);

  const declineCall = useCallback(() => {
    if (peerIdRef.current != null) socket.emit('declineCall', { to: peerIdRef.current });
    cleanup();
  }, [socket, cleanup]);

  const endCall = useCallback((silent = false) => {
    if (!silent && peerIdRef.current != null) socket.emit('endCall', { to: peerIdRef.current });
    cleanup();
  }, [socket, cleanup]);

  // Stable refs so listeners/handlers can call the latest impls without re-binding.
  const endCallRef = useRef(endCall);
  const declineCallRef = useRef(declineCall);
  endCallRef.current = endCall;
  declineCallRef.current = declineCall;

  const toggleMute = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks?.() || [];
    setMuted((m) => {
      tracks.forEach((t: any) => (t.enabled = m));
      return !m;
    });
  }, []);

  const toggleCam = useCallback(() => {
    const tracks = localRef.current?.getVideoTracks?.() || [];
    setCamOff((c) => {
      tracks.forEach((t: any) => (t.enabled = c));
      return !c;
    });
  }, []);

  const toggleSpeaker = useCallback(() => setSpeaker((s) => !s), []);

  const switchCamera = useCallback(() => {
    const track = localRef.current?.getVideoTracks?.()?.[0];
    try { track?._switchCamera?.(); } catch {}
  }, []);

  // ---- Signalling listeners ----
  useEffect(() => {
    if (!me || !available) return;

    const onIncoming = ({ callerId, callerName, callerPicture, video }: any) => {
      // Busy → auto-decline so the caller isn't left hanging.
      if (pcRef.current || status !== 'idle') { socket.emit('declineCall', { to: callerId }); return; }
      peerIdRef.current = Number(callerId);
      setPeer({ id: Number(callerId), name: callerName, avatar: callerPicture });
      setIsVideo(!!video);
      isVideoRef.current = !!video;
      setStatus('incoming');
    };

    const onAccepted = async () => {
      // We are the caller; create and send the offer.
      const pc = pcRef.current;
      if (!pc) return;
      setStatus('connecting');
      try {
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        socket.emit('offer', { to: peerIdRef.current, sdp: pc.localDescription });
      } catch {}
    };

    const onOffer = async ({ sdp }: any) => {
      const rtc = getWebRTC();
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new rtc.RTCSessionDescription(sdp));
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: peerIdRef.current, sdp: pc.localDescription });
        setStatus('connected');
      } catch {}
    };

    const onAnswer = async ({ sdp }: any) => {
      const rtc = getWebRTC();
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new rtc.RTCSessionDescription(sdp));
        await flushIce();
        setStatus('connected');
      } catch {}
    };

    const onIce = async ({ candidate }: any) => {
      if (!candidate) return;
      const rtc = getWebRTC();
      const c = new rtc.RTCIceCandidate(candidate);
      if (pcRef.current?.remoteDescription) { try { await pcRef.current.addIceCandidate(c); } catch {} }
      else pendingIce.current.push(c);
    };

    const onDeclined = () => cleanup();
    const onEnded = () => cleanup();

    socket.on('incomingCall', onIncoming);
    socket.on('callAccepted', onAccepted);
    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('iceCandidate', onIce);
    socket.on('callDeclined', onDeclined);
    socket.on('callEnded', onEnded);
    return () => {
      socket.off('incomingCall', onIncoming);
      socket.off('callAccepted', onAccepted);
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('iceCandidate', onIce);
      socket.off('callDeclined', onDeclined);
      socket.off('callEnded', onEnded);
    };
  }, [me, available, status, socket, flushIce, cleanup]);

  const value = useMemo<CallContextValue>(() => ({
    available, status, peer, isVideo, muted, camOff, speaker, localStream, remoteStream, error,
    startCall, acceptCall, declineCall, endCall, toggleMute, toggleCam, toggleSpeaker, switchCamera,
  }), [available, status, peer, isVideo, muted, camOff, speaker, localStream, remoteStream, error,
       startCall, acceptCall, declineCall, endCall, toggleMute, toggleCam, toggleSpeaker, switchCamera]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

function mediaError(e: any): string {
  const name = e?.name || '';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Микрофон не найден.';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Доступ к микрофону/камере запрещён. Разрешите его в настройках.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'Микрофон или камера заняты другим приложением.';
  if (e?.message === 'webrtc-unavailable') return 'Звонки недоступны в Expo Go — нужен установленный билд приложения.';
  return 'Не удалось получить доступ к микрофону/камере.';
}
