import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { createAuthRouter } from './auth/routes.js';
import { isMongoReady } from './database/mongo.js';
import { createHealthRouter } from './health/routes.js';
import { handleError, HttpError, notFound } from './http/errors.js';

export function createApp(config, { checkDatabase = isMongoReady } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, config.clientOrigins.has(origin)),
    credentials: true,
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
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/v1', createHealthRouter(checkDatabase));
  app.use('/api/v1/auth', createAuthRouter(config));
  app.use(notFound);
  app.use(handleError);

  return app;
}
