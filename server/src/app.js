import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { createClickRecorder } from './analytics/record.js';
import { createAnalyticsRouter } from './analytics/routes.js';
import { createAuthRouter } from './auth/routes.js';
import { isMongoReady } from './database/mongo.js';
import { createHealthRouter } from './health/routes.js';
import { handleError, HttpError, notFound } from './http/errors.js';
import { createLinksRouter } from './links/routes.js';
import { createAdminRouter } from './moderation/admin.js';
import { createSafetyRouter } from './moderation/public.js';
import { createRedirectRouter } from './redirects/routes.js';

export function createApp(config, { checkDatabase = isMongoReady, generateCode, recordClick = createClickRecorder(config) } = {}) {
  const app = express();
  if (config.trustedProxyIps?.length) app.set('trust proxy', config.trustedProxyIps);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, config.clientOrigins.has(origin)),
    credentials: true,
    exposedHeaders: ['X-Analytics-Export-Truncated'],
  }));
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response, next) => {
      response.set('Cache-Control', 'no-store');
      next(new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Try again later.'));
    },
  }));
  app.use('/api/v1/reports', express.json({ limit: '4kb' }));
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/v1', createHealthRouter(checkDatabase));
  app.use('/api/v1/auth', createAuthRouter(config));
  app.use('/api/v1/links', createLinksRouter(config, generateCode));
  app.use('/api/v1/analytics', createAnalyticsRouter(config));
  app.use('/api/v1', createSafetyRouter(config));
  app.use('/api/v1/admin', createAdminRouter(config));
  app.use('/api', notFound);
  app.use(createRedirectRouter(config, recordClick));
  app.use(notFound);
  app.use(handleError);

  return app;
}
