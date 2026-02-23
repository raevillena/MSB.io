/**
 * Redis client (ioredis) for token validation.
 * Token key: access:<token> -> JSON { userId, role, appId, expiresAt }
 */

import Redis from 'ioredis';
import config from './index.js';

let client = null;

/**
 * Get or create the Redis client singleton.
 * @returns {Redis}
 */
export function getRedisClient() {
  if (!client) {
    client = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    client.on('error', (err) => {
      console.error('[Redis] error:', err.message);
    });

    client.on('reconnect', () => {
      console.log('[Redis] reconnected');
    });
  }
  return client;
}

/**
 * Close the Redis connection (for graceful shutdown).
 */
export async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
  }
}
