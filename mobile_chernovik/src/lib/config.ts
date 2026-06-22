/**
 * Central runtime configuration.
 *
 * IMPORTANT — running on a real phone via Expo Go:
 * "localhost" on your phone points to the *phone*, not your PC. Set the address
 * of the machine running the backend here. Two ways:
 *   1) Easiest: create a `.env` file in /mobile with
 *         EXPO_PUBLIC_API_URL=http://192.168.X.X:3001
 *      (use your PC's LAN IP — `ipconfig` on Windows → IPv4 Address) and restart Expo.
 *   2) Or just edit LAN_HOST below to your PC's LAN IP.
 *
 * The backend listens on PORT=3050 (see chat_mess/back/.env).
 */

// ⬇️ EDIT THIS to your PC's LAN IP if you don't use a .env file.
// Wi-Fi LAN IP on this machine: 192.168.1.40  (run `ipconfig` if your IP changes)
const LAN_HOST = '192.168.1.40';
const PORT = 3050;

const MINIO_PORT = 9000;

const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
const minioFromEnv = process.env.EXPO_PUBLIC_MINIO_URL?.trim();

// In a desktop browser served from localhost, only "localhost" is guaranteed to
// be reachable — a stale LAN IP (in .env or LAN_HOST) gives ERR_CONNECTION_TIMED_OUT.
// So on web-localhost we force localhost and ignore the env override, which is
// meant for real devices that can't resolve "localhost" to this PC.
const isWebLocalhost =
  typeof window !== 'undefined' && window.location?.hostname === 'localhost';

export const BASE_URL = isWebLocalhost
  ? `http://localhost:${PORT}`
  : fromEnv || `http://${LAN_HOST}:${PORT}`;

/** Hostname (no scheme/port) of the resolved API base URL. */
function hostOf(url: string): string {
  const m = url.match(/^https?:\/\/([^/:]+)/i);
  return m ? m[1] : LAN_HOST;
}

// Files (MinIO) live on the SAME machine as the API. Derive the file host from
// BASE_URL so you only ever configure ONE address (env OR LAN_HOST) and images
// follow automatically — no second IP to keep in sync.
const fileHost = hostOf(BASE_URL);

export const MINIO_BASE_URL = minioFromEnv || `http://${fileHost}:${MINIO_PORT}`;

/**
 * Normalise a stored file URL so it's reachable from THIS device.
 * Rewrites backend-internal hosts (localhost / 127.0.0.1 / docker "minio") to the
 * reachable file host, preserving the original port. Other absolute URLs pass through.
 */
export function fixFileUrl(url?: string | null): string {
  if (!url) return '';
  let u = url.trim();
  u = u.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1|minio)(?=[:/]|$)/i, `$1${fileHost}`);
  if (/^https?:\/\//i.test(u)) return u;
  return `${MINIO_BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}
