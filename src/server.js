/**
 * HTTP server and graceful shutdown (SIGTERM/SIGINT).
 */

import app from './app.js';
import config from './config/index.js';
import { closeRedis } from './config/redis.js';
import { loadCorsOriginsFromRedis } from './config/corsOrigins.js';

let server;

async function start() {
  try {
    await loadCorsOriginsFromRedis();
  } catch (err) {
    console.error(
      '[CORS] Failed to load origins from Redis at startup; using env fallback only:',
      err?.message || err,
    );
  }

  server = app.listen(config.PORT, () => {
    console.log(`File service listening on port ${config.PORT}`);
  });
}

function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  server.close((err) => {
    if (err) console.error('Error closing server:', err);
    closeRedis()
      .then(() => {
        console.log('Redis closed');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error closing Redis:', err);
        process.exit(1);
      });
  });

  const forceExit = setTimeout(() => {
    console.error('Forced exit after timeout');
    process.exit(1);
  }, 10000);
  forceExit.unref?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
