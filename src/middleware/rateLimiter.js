/**
 * Rate limit for upload-url route (configurable via env).
 */

import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const windowMs = 60 * 1000; // 1 minute
const max = parseInt(process.env.RATE_LIMIT_UPLOAD_URL_MAX, 10) || 30;

/**
 * Rate limiter for POST /api/files/upload-url.
 */
export const uploadUrlRateLimiter = rateLimit({
  windowMs,
  max,
  message: { error: true, message: 'Too many requests', code: 429 },
  standardHeaders: true,
  legacyHeaders: false,
});
