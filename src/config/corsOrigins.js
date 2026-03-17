/**
 * CORS origins loader.
 * - Primary source: Redis key "allowed_origins".
 * - Fallback: static list from CORS_ALLOWED_ORIGINS env.
 */

import config from './index.js';
import { getRedisClient } from './redis.js';

let cachedOrigins = null;

const normalizeOrigins = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((s) => String(s).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (typeof value === 'object' && Array.isArray(value.origins)) {
    return normalizeOrigins(value.origins);
  }

  return [];
};

export const getEnvCorsOrigins = () => config.CORS_ALLOWED_ORIGINS;

export const getCorsOrigins = () => {
  if (cachedOrigins && cachedOrigins.length > 0) {
    return cachedOrigins;
  }
  return getEnvCorsOrigins();
};

/**
 * Load allowed origins from Redis key "allowed_origins".
 * - Expected value: JSON array of strings, e.g. ["https://app.example.com","https://admin.example.com"]
 * - Also supports: comma-separated string or { origins: [...] } object.
 */
export const loadCorsOriginsFromRedis = async () => {
  try {
    const client = getRedisClient();
    const raw = await client.get('allowed_origins');

    if (!raw) {
      console.warn(
        '[CORS] Redis key "allowed_origins" is missing or empty; falling back to env list',
      );
      cachedOrigins = null;
      return getCorsOrigins();
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If it's not JSON, treat as plain string (e.g. comma-separated).
      parsed = raw;
    }

    const origins = normalizeOrigins(parsed);

    if (origins.length === 0) {
      console.warn(
        '[CORS] Redis "allowed_origins" parsed to an empty list; falling back to env list',
      );
      cachedOrigins = null;
      return getCorsOrigins();
    }

    cachedOrigins = origins;
    console.log('[CORS] Loaded allowed origins from Redis:', origins);
    return cachedOrigins;
  } catch (err) {
    console.error(
      '[CORS] Error loading origins from Redis (allowed_origins); using env fallback:',
      err?.message || err,
    );
    cachedOrigins = null;
    return getCorsOrigins();
  }
};

