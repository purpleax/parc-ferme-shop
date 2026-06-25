import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import {
  apiNotFound,
  attachUser,
  errorHandler,
  requestId,
  requestLogger,
} from './middleware.js';
import { openapiSpec } from './openapi.js';
import authRouter from './routes/auth.js';
import catalogRouter from './routes/catalog.js';
import imagesRouter from './routes/images.js';
import cartRouter from './routes/cart.js';
import { ordersRouter, paymentsRouter } from './routes/orders.js';
import adminRouter from './routes/admin.js';
import miscRouter from './routes/misc.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind CDN/WAF in demos

  app.use(cors({ origin: true, exposedHeaders: ['X-Request-Id'] }));
  app.use(express.json({ limit: '100kb' }));
  app.use(requestId);
  app.use(attachUser);
  app.use(requestLogger);

  // API docs
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'Parc Fermé API' }));

  // Images are cacheable (CDN demo traffic).
  app.use('/api/images', imagesRouter);

  app.use('/api', miscRouter);
  app.use('/api/auth', authRouter);
  app.use('/api', catalogRouter);
  app.use('/api/cart', cartRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', apiNotFound);

  // Serve the built frontend when present (production / Docker).
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
