/**
 * Validate opaque access token via Redis; attach req.user.
 * Reject if missing, not found, or expired.
 */

import { getRedisClient } from '../config/redis.js';

const TOKEN_PREFIX = 'access:';

function sendUnauthorized(res, message = 'Unauthorized') {
  res.status(401).json({ error: true, message, code: 401 });
}

function sendServiceUnavailable(res, requestId) {
  console.error(`[${requestId}] Redis error during token validation`);
  res.status(503).json({ error: true, message: 'Service temporarily unavailable', code: 503 });
}

/**
 * Extract Bearer token from Authorization header and validate with Redis.
 * Sets req.user = { userId, role, appId }. Rejects with 401 or 503 on failure.
 */
export async function authMiddleware(req, res, next) {
  const requestId = req.id || '-';
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return sendUnauthorized(res, 'Missing or invalid Authorization header');
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return sendUnauthorized(res, 'Missing Bearer token');
  }

  const redis = getRedisClient();
  let raw;
  try {
    raw = await redis.get(`${TOKEN_PREFIX}${token}`);
  } catch (err) {
    return sendServiceUnavailable(res, requestId);
  }

  if (!raw) {
    return sendUnauthorized(res, 'Invalid or expired token');
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return sendUnauthorized(res, 'Invalid token payload');
  }

  const { userId, role, appId, expiresAt } = payload;
  if (!userId || appId === undefined) {
    return sendUnauthorized(res, 'Invalid token payload');
  }

  const now = Date.now();
  const expiresAtMs = typeof expiresAt === 'number' ? expiresAt : parseInt(expiresAt, 10);
  if (Number.isNaN(expiresAtMs) || now >= expiresAtMs) {
    return sendUnauthorized(res, 'Token expired');
  }

  req.user = { userId: String(userId), role: String(role ?? ''), appId: Number(appId) };
  next();
}
