import { Platform } from "react-native";

// export const BASE_URL = Platform.select({
//   web: "https://polat.digital",
//   default: "https://polat.digital",
// });

// export const MINIO_BASE_URL = Platform.select({
//   web: "https://minio.polat.digital",
//   default: "https://minio.polat.digital",
// });

// localhost версия:
export const BASE_URL = Platform.select({
  web: "http://localhost:3000",
  default: "http://192.168.1.120:3000",
});

export const MINIO_BASE_URL = Platform.select({
  web: "http://localhost:9000",
  default: "http://192.168.1.120:9000",
});

// Исправляет URL файлов с localhost на правильный IP для мобильного устройства
export const fixFileUrl = (url) => {
  if (!url) return url;
  if (Platform.OS === 'web') return url;
  return url.replace('http://localhost:9000', MINIO_BASE_URL);
};
