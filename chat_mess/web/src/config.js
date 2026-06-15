// Central configuration for the web client.
// The backend (Express + Socket.IO) runs on :3000, MinIO on :9000.
// Override at build/run time with VITE_API_URL / VITE_MINIO_URL if needed.

export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
export const MINIO_BASE_URL = import.meta.env.VITE_MINIO_URL || "http://localhost:9000";

// Some stored file URLs may already be absolute MinIO presigned links — pass through.
export const fixFileUrl = (url) => url || "";
