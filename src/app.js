/**
 * Express app: middleware wiring, routes, error handler.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import config from './config/index.js';
import { getCorsOrigins } from './config/corsOrigins.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import fileRoutes from './routes/fileRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const app = express();

// CORS: allow only configured origins, loaded from remote API (optional) with env fallback
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = getCorsOrigins();

  if (origin && Array.isArray(allowed) && allowed.length > 0 && allowed.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }

  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(requestIdMiddleware);
app.use(helmet());
app.use(express.json({ limit: config.MAX_UPLOAD_SIZE }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API docs: Swagger UI + OpenAPI spec (served from repo docs/)
app.use(
  '/docs/swagger-ui',
  express.static(path.join(projectRoot, 'node_modules', 'swagger-ui-dist')),
);
app.use('/docs', express.static(path.join(projectRoot, 'docs')));
app.get('/docs', (req, res) => res.redirect(302, '/docs/swagger.html'));

app.use('/api/files', fileRoutes);

app.use(errorHandlerMiddleware);

export default app;
