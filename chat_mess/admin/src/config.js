// Central config for the admin console.
// Backend (Express + Socket.IO) runs on :3000, MinIO on :9000.
export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3050";
export const MINIO_BASE_URL = import.meta.env.VITE_MINIO_URL || "http://localhost:9000";


export const fixFileUrl = (url) => url || "";
