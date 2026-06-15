// src/utils/rtc.js
import { Platform } from 'react-native';
import { useRef, useEffect } from 'react';

let RTCPeerConnection;
let RTCSessionDescription;
let RTCIceCandidate;
let mediaDevices;
let RTCView;

if (Platform.OS === 'web') {
  // Вебовая реализация
  RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
  RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;

  mediaDevices = {
    getUserMedia: async (constraints) => {
      return navigator.mediaDevices.getUserMedia(constraints);
    },
  };

  // Обёртка для <RTCView> – используем тег <video>
  RTCView = function RTCView(props) {
    const videoRef = useRef(null);
    useEffect(() => {
      if (videoRef.current && props.streamURL) {
        videoRef.current.srcObject = props.streamURL;
        videoRef.current.play().catch(err => console.warn('Autoplay error:', err));
      }
    }, [props.streamURL]);
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        style={props.style || { width: 200, height: 200, backgroundColor: 'black' }}
      />
    );
  };
} else {
  // Мобильная реализация
  try {
    const WebRTC = require('react-native-webrtc');
    RTCPeerConnection = WebRTC.RTCPeerConnection;
    RTCSessionDescription = WebRTC.RTCSessionDescription;
    RTCIceCandidate = WebRTC.RTCIceCandidate;
    RTCView = WebRTC.RTCView;
    mediaDevices = WebRTC.mediaDevices;
  } catch (e) {
    console.warn('react-native-webrtc не доступен:', e.message);
  }
}

export {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  mediaDevices,
};
    