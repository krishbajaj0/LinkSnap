import { createHash, createHmac } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../http/errors.js';
import { Link } from '../links/model.js';
import { isShortCode } from '../links/paths.js';
import { linkStatus } from '../links/service.js';
import { assessDestination } from '../security/url-safety.js';
import { reasons, Report } from './model.js';

export function readText(value = '') {
  if (typeof value !== 'string' || value.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value)) {
    throw new HttpError(400, 'INVALID_TEXT', 'Enter up to 500 characters of plain text.');
  }
  // Keep as plain text; all frontend consumers render it via React text nodes.
  return value.trim().replace(/\r\n?/g, '\n');
}

const unavailable = () => new HttpError(404, 'SHORT_LINK_UNAVAILABLE', 'Short link is unavailable.');

export function createSafetyRouter(config) {
  const router = Router();
  const reportsLimit = rateLimit({
    windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many reports. Try again later.')),
  });

  router.get('/preview/:code', async (request, response) => {
    response.set('Cache-Control', 'no-store');
    const code = request.params.code;
    if (!config.mongoUri || !isShortCode(code)) throw unavailable();
    const link = await Link.findOne({ shortCode: code })
      .select('destination enabled expiresAt deletedAt securityBlocked').read('primary').lean();
    if (!link || linkStatus(link) !== 'active') throw unavailable();

    let result;
    try {
      result = assessDestination(link.destination, config.prohibitedDomains);
    } catch {
      throw unavailable();
    }
    if (result.classification === 'blocked') throw unavailable();
    response.json({ success: true, data: {
      hostname: result.hostname, protocol: result.protocol,
      needsReview: result.classification === 'needs-review', continuePath: '/' + code,
    } });
  });

  router.post('/reports', reportsLimit, async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (!request.is('application/json')) throw new HttpError(415, 'JSON_REQUIRED', 'Send a JSON report.');
    const { shortCode, reason, description, website } = request.body ?? {};
    if (typeof shortCode !== 'string' || !isShortCode(shortCode) || !reasons.includes(reason)
        || Object.keys(request.body ?? {}).some((key) => !['shortCode', 'reason', 'description', 'website'].includes(key))) {
      throw new HttpError(400, 'INVALID_REPORT', 'Enter a valid short code and report reason.');
    }
    const text = readText(description);
    const accept = () => response.status(202).json({ success: true, data: { message: 'Report received for consideration.' } });
    if (!config.mongoUri) throw new HttpError(503, 'REPORTS_UNAVAILABLE', 'Reporting is temporarily unavailable.');
    if (website) return accept();
    const link = await Link.findOne({ shortCode, deletedAt: null }).select('_id').lean();
    if (!link) return accept();

    const scope = JSON.stringify([String(link._id), reason, new Date().toISOString().slice(0, 10)]);
    const fingerprint = config.authSecret
      ? createHmac('sha256', config.authSecret).update('linksnap/report/v1\0').update(scope).update(request.ip ?? '').digest('hex')
      : createHash('sha256').update(scope).digest('hex');
    try {
      await Report.create({ linkId: link._id, reason, description: text, fingerprint });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    accept();
  });

  return router;
}
