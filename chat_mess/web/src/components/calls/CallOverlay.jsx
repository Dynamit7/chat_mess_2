import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "../Avatar";
import { IPhone, IVideo, IMute, IVolume, ICamera, IClose } from "../Icon";
import { useCall } from "../../context/CallContext";

export default function CallOverlay() {
  const call = useCall();
  const { status, peer, isVideo, muted, camOff } = call;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Bind media streams to the <video> elements.
  useEffect(() => {
    if (localVideoRef.current && call.localStream.current) localVideoRef.current.srcObject = call.localStream.current;
    if (remoteVideoRef.current && call.remoteStream.current) remoteVideoRef.current.srcObject = call.remoteStream.current;
  }); // run every render so late-arriving streams attach

  if (status === "idle") return null;

  const inCall = status === "connecting" || status === "connected";

  return (
    <AnimatePresence>
      <motion.div
        className="call-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Remote video fills the screen for video calls */}
        {isVideo && inCall && (
          <video ref={remoteVideoRef} data-remote-video autoPlay playsInline className="call-remote-video" />
        )}
        {/* Audio always plays via a hidden element */}
        {!isVideo && inCall && (
          <audio ref={remoteVideoRef} data-remote-video autoPlay />
        )}

        <div className={`call-stage ${isVideo && inCall ? "video" : ""}`}>
          {(!isVideo || !inCall) && (
            <div className="call-peer">
              <div className="call-avatar-ring"><Avatar src={peer?.picture} name={peer?.name} size={120} /></div>
              <h2>{peer?.name || "Unknown"}</h2>
              <p>
                {status === "incoming" && `Incoming ${isVideo ? "video " : ""}call…`}
                {status === "calling" && "Calling…"}
                {status === "connecting" && "Connecting…"}
                {status === "connected" && "In call"}
              </p>
            </div>
          )}

          {isVideo && inCall && (
            <video ref={localVideoRef} autoPlay playsInline muted className="call-local-video" />
          )}

          {/* Controls */}
          <div className="call-controls">
            {status === "incoming" ? (
              <>
                <button className="call-btn decline" onClick={call.declineCall}><IClose size={26} /></button>
                <button className="call-btn accept" onClick={call.acceptCall}><IPhone size={26} /></button>
              </>
            ) : (
              <>
                <button className={`call-btn ctrl ${muted ? "active" : ""}`} onClick={call.toggleMute} title="Mute">
                  {muted ? <IMute size={22} /> : <IVolume size={22} />}
                </button>
                {isVideo && (
                  <button className={`call-btn ctrl ${camOff ? "active" : ""}`} onClick={call.toggleCam} title="Camera">
                    <ICamera size={22} />
                  </button>
                )}
                <button className="call-btn decline" onClick={() => call.endCall()} title="End call"><IPhone size={24} /></button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
