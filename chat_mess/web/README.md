# DeFensy — Web

A premium React.js (Vite) web client for the DeFensy chat backend.
Brand-new "awwwards-level" dark, glassmorphic design — built from scratch for desktop.

## What's included (full mobile parity)

- **Auth** — login, register, email-code verification, two-factor.
- **Direct messages** — realtime text/images/video/audio/files, typing, presence,
  read receipts, reactions, replies, edit & delete, forwarding.
- **Groups** — create, members/admin, realtime group chat over **protobuf**, replies,
  edit/delete, typing, read receipts, polls.
- **Channels** — broadcast posts, comments, emoji reactions, polls, subscribers.
- **Stories** — tray with rings, fullscreen viewer (progress bars, autoplay),
  create (photo/video + caption), viewers list, 24h expiry.
- **Settings** — profile editing & avatar, privacy (visibility, ghost mode, read
  receipts), 2FA enable/disable, blocked users, OpenAI translation settings.
- **Polls** — create in groups/channels (anonymous, multiple answers, quiz mode),
  vote, live results, retract.
- **Reels** — vertical scroll-snap video feed (For You / Discover), autoplay,
  like/comment/share/follow, create.
- **Calls** — 1-on-1 WebRTC voice & video over Socket.IO signalling.

The rail (left) switches between Chats · Groups · Channels · Stories · Reels, plus
a Settings panel.

## Requirements

The backend must be running first (from `../back`):

- Express API + Socket.IO on **http://localhost:3000**
- PostgreSQL, Redis and MinIO (see `../back/docker-compose.yml` and `../docker-compose.yml`)

## Run

```bash
npm install
npm run dev      # http://localhost:5174 (or next free port)
```

Open the printed URL and sign in with an existing account.
A verification code is emailed on login (the backend uses Gmail SMTP).

### Configuration

The API/MinIO URLs default to localhost. Override via a `.env` file if needed:

```
VITE_API_URL=http://localhost:3000
VITE_MINIO_URL=http://localhost:9000
```

## Build

```bash
npm run build    # outputs to dist/
npm run preview
```

## Project layout

```
src/
  api/client.js          axios client + typed endpoint helpers
  socket.js              shared Socket.IO connection
  context/               Auth, Socket, Toast providers
  components/            Icon set, Avatar, Aurora bg, AuthLayout
  components/chat/       Rail, Sidebar, ConversationPane, MessageBubble, Composer
  pages/                 Login, Register, VerifyCode, TwoFactor, ChatHome
  index.css              the full premium design system
```
