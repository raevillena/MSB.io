/**
 * Express app: middleware wiring, routes, error handler.
 */

import express from 'express';
import helmet from 'helmet';
import config from './config/index.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandlerMiddleware } from './middleware/errorHandler.js';
import fileRoutes from './routes/fileRoutes.js';

const app = express();

app.use(requestIdMiddleware);
app.use(helmet());
app.use(express.json({ limit: config.MAX_UPLOAD_SIZE }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/files', fileRoutes);

app.use(errorHandlerMiddleware);

export default app;
