import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import socket from "../socket";
import { useAuth } from "./AuthContext";

const CallContext = createContext(null);

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

// One active call at a time. WebRTC signalling over Socket.IO (callUser /
// acceptCall / declineCall / endCall / offer / answer / iceCandidate).
export function CallProvider({ children }) {
  const { user } = useAuth();
  const me = Number(user?.userId);

  const [status, setStatus] = useState("idle"); // idle|calling|incoming|connecting|connected
  const [peer, setPeer] = useState(null); // {id, name, picture}
  const [isVideo, setIsVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const pcRef = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const pendingIce = useRef([]);
  const peerIdRef = useRef(null);

  const attachLocal = (el) => { if (el && localRef.current) el.srcObject = localRef.current; };
  const attachRemote = (el) => { if (el && remoteRef.current) el.srcObject = remoteRef.current; };

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    remoteRef.current = null;
    pendingIce.current = [];
    peerIdRef.current = null;
    setStatus("idle");
    setPeer(null);
    setMuted(false);
    setCamOff(false);
  }, []);

  const getMedia = async (video) => {
    if (video) {
      // Пробуем видео+аудио; если камера недоступна — fallback на аудио
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localRef.current = stream;
        return stream;
      } catch (e) {
        if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError" || e?.name === "NotReadableError") {
          // Камера не найдена или занята — пробуем только аудио
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localRef.current = stream;
          setIsVideo(false); // понижаем до аудиозвонка
          return stream;
        }
        throw e;
      }
    }
    // Аудиозвонок
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localRef.current = stream;
    return stream;
  };

  const getMediaError = (e) => {
    if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
      return "Микрофон не найден. Подключите гарнитуру с микрофоном или проверьте настройки звука.";
    }
    if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
      return "Доступ к микрофону запрещён. Нажмите на иконку замка в адресной строке браузера и разрешите доступ.";
    }
    if (e?.name === "NotReadableError" || e?.name === "TrackStartError") {
      return "Микрофон или камера уже используется другим приложением. Закройте его и попробуйте снова.";
    }
    if (e?.name === "OverconstrainedError") {
      return "Выбранное аудиоустройство не поддерживает нужные параметры.";
    }
    return "Не удалось получить доступ к микрофону/камере.";
  };

  const buildPc = (toId) => {
    const pc = new RTCPeerConnection(ICE);
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current));
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("iceCandidate", { to: toId, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      remoteRef.current = e.streams[0];
      // Nudge any mounted <video> to pick up the stream.
      document.querySelectorAll("[data-remote-video]").forEach((v) => { v.srcObject = e.streams[0]; });
    };
    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) endCall(true);
      if (pc.connectionState === "connected") setStatus("connected");
    };
    pcRef.current = pc;
    return pc;
  };

  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIce.current) { try { await pc.addIceCandidate(c); } catch {} }
    pendingIce.current = [];
  };

  // ---- Outgoing ----
  const startCall = useCallback(async (partner, { video = false } = {}) => {
    if (status !== "idle") return;
    try {
      setIsVideo(video);
      setPeer({ id: Number(partner.partnerId ?? partner.id), name: partner.username || partner.name, picture: partner.picture || partner.avatar });
      peerIdRef.current = Number(partner.partnerId ?? partner.id);
      setStatus("calling");
      await getMedia(video);
      buildPc(peerIdRef.current);
      socket.emit("callUser", {
        to: peerIdRef.current,
        callerId: me,
        callerName: user.username,
        callerPicture: user.avatar || null,
      });
    } catch (e) {
      cleanup();
      alert(getMediaError(e));
    }
  }, [status, me, user, cleanup]);

  // ---- Incoming accept/decline ----
  const acceptCall = useCallback(async () => {
    try {
      await getMedia(isVideo);
      buildPc(peerIdRef.current);
      setStatus("connecting");
      socket.emit("acceptCall", { to: peerIdRef.current });
    } catch (e) {
      alert(getMediaError(e));
      declineCall();
    }
  }, [isVideo]);

  const declineCall = useCallback(() => {
    if (peerIdRef.current) socket.emit("declineCall", { to: peerIdRef.current });
    cleanup();
  }, [cleanup]);

  const endCall = useCallback((silent = false) => {
    if (!silent && peerIdRef.current) socket.emit("endCall", { to: peerIdRef.current });
    cleanup();
  }, [cleanup]);

  const toggleMute = () => {
    const tracks = localRef.current?.getAudioTracks() || [];
    tracks.forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  };
  const toggleCam = () => {
    const tracks = localRef.current?.getVideoTracks() || [];
    tracks.forEach((t) => (t.enabled = camOff));
    setCamOff((c) => !c);
  };

  // ---- Signalling listeners ----
  useEffect(() => {
    if (!me) return;

    const onIncoming = ({ callerId, callerName, callerPicture }) => {
      if (pcRef.current || status !== "idle") { socket.emit("declineCall", { to: callerId }); return; }
      peerIdRef.current = Number(callerId);
      setPeer({ id: Number(callerId), name: callerName, picture: callerPicture });
      setIsVideo(true); // accept with video capability; user can turn cam off
      setStatus("incoming");
    };

    const onAccepted = async () => {
      // We are the caller; create and send the offer.
      const pc = pcRef.current;
      if (!pc) return;
      setStatus("connecting");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: peerIdRef.current, sdp: pc.localDescription });
    };

    const onOffer = async ({ sdp }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: peerIdRef.current, sdp: pc.localDescription });
      setStatus("connected");
    };

    const onAnswer = async ({ sdp }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushIce();
      setStatus("connected");
    };

    const onIce = async ({ candidate }) => {
      if (!candidate) return;
      const c = new RTCIceCandidate(candidate);
      if (pcRef.current?.remoteDescription) { try { await pcRef.current.addIceCandidate(c); } catch {} }
      else pendingIce.current.push(c);
    };

    const onDeclined = () => cleanup();
    const onEnded = () => cleanup();

    socket.on("incomingCall", onIncoming);
    socket.on("callAccepted", onAccepted);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("iceCandidate", onIce);
    socket.on("callDeclined", onDeclined);
    socket.on("callEnded", onEnded);
    return () => {
      socket.off("incomingCall", onIncoming);
      socket.off("callAccepted", onAccepted);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("iceCandidate", onIce);
      socket.off("callDeclined", onDeclined);
      socket.off("callEnded", onEnded);
    };
  }, [me, status, cleanup]);

  const value = {
    status, peer, isVideo, muted, camOff,
    startCall, acceptCall, declineCall, endCall, toggleMute, toggleCam,
    attachLocal, attachRemote, localStream: localRef, remoteStream: remoteRef,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
};
