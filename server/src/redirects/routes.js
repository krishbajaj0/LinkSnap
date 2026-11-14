import { Router } from 'express';
import { HttpError } from '../http/errors.js';
import { Link } from '../links/model.js';
import { isShortCode } from '../links/paths.js';
import { linkStatus } from '../links/service.js';
import { assessDestination } from '../security/url-safety.js';

export function createRedirectRouter(config, recordClick) {
  const router = Router();
  router.get('/:shortCode', async (request, response, next) => {
    const { shortCode } = request.params;
    if (!isShortCode(shortCode)) return next();
    response.set('Cache-Control', 'no-store');
    response.set('Referrer-Policy', 'no-referrer');

    const unavailable = new HttpError(404, 'SHORT_LINK_UNAVAILABLE', 'Short link is unavailable.');
    if (!config.mongoUri) throw unavailable;
    const link = await Link.findOne({ shortCode })
      .select('ownerId destination enabled expiresAt deletedAt securityBlocked').read('primary').lean();
    if (!link || linkStatus(link) !== 'active') throw unavailable;

    let destination;
    try {
      const assessment = assessDestination(link.destination, config.prohibitedDomains);
      if (assessment.classification === 'blocked') throw unavailable();
      destination = assessment.destination;
    } catch {
      throw unavailable;
    }

    // Capture the trusted peer before Node can detach the socket at response end.
    const clientIp = request.method === 'GET' ? request.ip ?? '' : '';
    response.status(302).location(destination).end();
    if (request.method === 'GET') {
      setImmediate(() => {
        void Promise.resolve().then(() => recordClick(request, link, clientIp)).catch(() => {});
      });
    }
  });
  return router;
}
