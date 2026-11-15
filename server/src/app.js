import { isIP } from 'node:net';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { createClickRecorder } from './analytics/record.js';
import { createAnalyticsRouter } from './analytics/routes.js';
import { createAuthRouter } from './auth/routes.js';
import { isMongoReady } from './database/mongo.js';
import { createFrontendRouter } from './frontend.js';
import { createHealthRouter } from './health/routes.js';
import { handleError, HttpError, notFound } from './http/errors.js';
import { createLinksRouter } from './links/routes.js';
import { createAdminRouter } from './moderation/admin.js';
import { createSafetyRouter } from './moderation/public.js';
import { createRedirectRouter } from './redirects/routes.js';

export function createApp(config, {
  checkDatabase = isMongoReady, generateCode, recordClick = createClickRecorder(config), frontendDirectory,
} = {}) {
  const app = express();
  if (config.trustRenderEdge) {
    // Render's public edge overwrites CF-Connecting-IP. The operator must ensure every
    // public request passes through that edge and there is no direct or private ingress.
    app.set('trust proxy', 1);
    app.use((request, _response, next) => {
      const clientIp = request.get('CF-Connecting-IP');
      for (const name of ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']) {
        delete request.headers[name];
      }
      if (clientIp && !clientIp.includes('%') && isIP(clientIp)) {
        request.headers['x-forwarded-for'] = clientIp;
      }
      next();
    });
  } else if (config.trustedProxyIps?.length) {
    app.set('trust proxy', config.trustedProxyIps);
  }
  app.disable('x-powered-by');
  app.use(helmet(config.environment === 'production' ? {
    contentSecurityPolicy: {
      directives: {
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
  } : undefined));
  app.use(cors({
    origin: (origin, callback) => callback(null, config.clientOrigins.has(origin)),
    credentials: true,
    exposedHeaders: ['X-Analytics-Export-Truncated'],
  }));
  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: 120,
    // Keep the production process probe independent of a shared proxy rate-limit bucket.
    skip: (request) => config.environment === 'production'
      && ['GET', 'HEAD'].includes(request.method) && /^\/v1\/health\/?$/i.test(request.path),
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
  if (config.environment === 'production') app.use(createFrontendRouter(frontendDirectory));
  app.use(notFound);
  app.use(handleError);

  return app;
}
