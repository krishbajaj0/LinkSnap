import { Router } from 'express';
import { HttpError } from '../http/errors.js';

export function createHealthRouter(checkDatabase) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/health', (_request, response) => {
    response.json({ success: true, data: { status: 'ok' } });
  });

  router.get('/health/ready', async (_request, response) => {
    if (!(await checkDatabase())) {
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable.');
    }

    response.json({ success: true, data: { status: 'ready' } });
  });

  return router;
}
