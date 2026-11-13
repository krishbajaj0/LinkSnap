import { Router } from 'express';
import { requireUser } from '../auth/middleware.js';
import { createTokens } from '../auth/tokens.js';
import { HttpError } from '../http/errors.js';
import { Link } from '../links/model.js';
import { validateLinkId } from '../links/validation.js';
import { exportEvents, readRange, summarize } from './query.js';

export function createAnalyticsRouter(config) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  if (!config.mongoUri || !config.authSecret) {
    router.use(() => { throw new HttpError(503, 'ANALYTICS_UNAVAILABLE', 'Analytics is unavailable.'); });
    return router;
  }

  router.use(requireUser(createTokens(config.authSecret)));
  router.param('id', async (request, _response, next, id) => {
    validateLinkId(id);
    const link = await Link.findOne({ _id: id, ownerId: request.user._id, deletedAt: null }).select('shortCode').lean();
    if (!link) throw new HttpError(404, 'LINK_NOT_FOUND', 'Link not found.');
    request.analyticsLink = link;
    next();
  });

  const owned = (request) => ({
    ownerId: request.user._id,
    ...(request.analyticsLink && { linkId: request.analyticsLink._id }),
  });

  async function report(request, response) {
    const data = await summarize(owned(request), readRange(request.query), Boolean(config.visitorSecret));
    if (request.analyticsLink) data.shortCode = request.analyticsLink.shortCode;
    response.json({ success: true, data });
  }

  async function csv(request, response) {
    const { csv: body, truncated } = await exportEvents(owned(request), readRange(request.query));
    response.set('X-Analytics-Export-Truncated', String(truncated));
    response.attachment('linksnap-analytics.csv').type('text/csv').send(body);
  }

  router.get('/', report);
  router.get('/export.csv', csv);
  router.get('/links/:id', report);
  router.get('/links/:id/export.csv', csv);
  return router;
}
