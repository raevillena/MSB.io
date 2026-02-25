/**
 * Express app: middleware wiring, routes, error handler.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import config from './config/index.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import fileRoutes from './routes/fileRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const app = express();

app.use(requestIdMiddleware);
app.use(helmet());
app.use(express.json({ limit: config.MAX_UPLOAD_SIZE }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API docs: Swagger UI + OpenAPI spec (served from repo docs/)
app.use('/docs', express.static(path.join(projectRoot, 'docs')));
app.get('/docs', (req, res) => res.redirect(302, '/docs/swagger.html'));

app.use('/api/files', fileRoutes);

app.use(errorHandlerMiddleware);

export default app;
