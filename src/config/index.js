/**
 * Central config: reads only from process.env (no dotenv).
 * Fail fast at startup if required vars are missing.
 */

const required = [
  'REDIS_HOST',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
];

for (const key of required) {
  if (!process.env[key]?.trim()) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const parsePort = (value, defaultPort) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1 || n > 65535) return defaultPort;
  return n;
};

const parsePositiveInt = (value, defaultVal) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return defaultVal;
  return n;
};

/** Comma-separated MIME types from env, or default allowlist */
const getAllowedMimeTypes = () => {
  const raw = process.env.ALLOWED_MIME_TYPES;
  if (raw?.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/json',
  ];
};

const config = {
  PORT: parsePort(process.env.PORT, 3000),
  REDIS_HOST: process.env.REDIS_HOST.trim(),
  REDIS_PORT: parsePort(process.env.REDIS_PORT, 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD?.trim() || undefined,

  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT.trim(),
  MINIO_PORT: parsePort(process.env.MINIO_PORT, 9000),
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY.trim(),
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY.trim(),
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',
  MINIO_BUCKET_PREFIX: (process.env.MINIO_BUCKET_PREFIX || 'files').trim(),

  /** Max upload size in bytes (for validation; actual upload is client -> MinIO) */
  MAX_UPLOAD_SIZE: parsePositiveInt(process.env.MAX_UPLOAD_SIZE, 10 * 1024 * 1024), // 10MB default

  ALLOWED_MIME_TYPES: getAllowedMimeTypes(),

  /** When true, create app bucket on first use if it does not exist */
  AUTO_CREATE_BUCKETS: process.env.AUTO_CREATE_BUCKETS === 'true',

  /** Signed URL expiry in seconds */
  UPLOAD_URL_EXPIRES_IN: 120,
};

export default config;
