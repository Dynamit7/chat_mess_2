/**
 * Lazy, guarded access to react-native-webrtc. The native module is absent in
 * Expo Go and on web, where `require` throws — we catch it and expose `null`, so
 * the rest of the app keeps working and calls degrade to an "unavailable" state.
 * In a development/production build the native module loads normally.
 */
let mod: any = null;
let loaded = false;

export function getWebRTC(): any | null {
  if (loaded) return mod;
  loaded = true;
  try {
    mod = require('react-native-webrtc');
  } catch {
    mod = null;
  }
  return mod;
}

export const isWebRTCAvailable = () => !!getWebRTC()?.RTCPeerConnection;
