# Nexus — Mobile (React Native · Expo)

The mobile client for the `chat_mess` messenger backend. Dark, glassmorphic,
aurora-lit UI built with **Expo Router**, **Reanimated**, **expo-blur** and a
custom design system that mirrors the web client.

## What's implemented (v1 — core messenger)

- **Auth flow** — login → emailed 6-digit code → optional two-factor → session
  (tokens stored in the device keychain via `expo-secure-store`, silent refresh on 401).
- **Chats** — real-time conversation list (Socket.IO): live last-message, unread
  badges, online/offline presence, pull-to-refresh, swipe-free long-press delete.
- **Conversation** — real-time messaging with optimistic send, typing indicator,
  delivery/read ticks (✓ / ✓✓), emoji reactions, reply, edit, delete, copy,
  image & file sharing (upload to MinIO), full-screen image viewer.
- **New chat** — debounced username search.
- **Profile & settings** — avatar upload, identity, sign-out.
- **Groups / Channels / Reels** — on-brand placeholder screens, wired to the same
  API client and ready to build out next.

## Voice & video calls (WebRTC)

Real 1-to-1 audio/video calls run over **`react-native-webrtc`** with Socket.IO
signalling (`callUser` / `offer` / `answer` / `iceCandidate`). Because that's a
native module, **calls work only in a development/production build — not in Expo
Go** (there they degrade gracefully to an "unavailable" alert; everything else
keeps working).

```bash
# one-time dev client build (then use `npx expo start --dev-client`)
eas build --profile development --platform android
```

ICE servers come from the backend (`GET /api/calls/ice-servers`). For calls
across different networks set TURN env vars on the backend (`TURN_URL`,
`TURN_USER`, `TURN_PASS`); STUN alone only covers same-network / simple NATs.

## Run it (Expo Go)

1. **Start the backend** (`chat_mess/back`) so it listens on `:3050`.
   Make sure your firewall allows your phone to reach the PC on that port.
2. **Point the app at your PC.** Either:
   - copy `.env.example` → `.env` and set your LAN IP, **or**
   - edit `LAN_HOST` in [`src/lib/config.ts`](src/lib/config.ts).
   Find your IP with `ipconfig` (IPv4 Address). Detected here: `192.168.1.38`.
3. Install & start:
   ```bash
   npm install --legacy-peer-deps
   npx expo start
   ```
4. Open **Expo Go** on your phone (same Wi-Fi) and scan the QR code.

> ⚠️ The backend currently allows CORS only from the web dev origins. Socket.IO
> auth is enforced (`ENFORCE_AUTH=1`); the app sends the JWT automatically.
> If the phone can't connect, double-check the LAN IP and that `:3050` is reachable.

## Project layout

```
app/                     # Expo Router routes
  (auth)/                #   login · register · verify · two-factor
  (app)/
    (tabs)/              #   chats · groups · channels · reels · profile
    chat/[id].tsx        #   conversation screen
    new-chat.tsx · settings.tsx
src/
  theme/theme.ts         # colors, gradients, spacing, fonts, shadows
  lib/                   # config · api · socket · storage · format
  state/                 # auth + socket providers
  components/ui/         # AuroraBackground, GlassCard, Avatar, Button, TabBar…
  components/chat/       # ChatRow, MessageBubble, Composer, ActionSheet
```
