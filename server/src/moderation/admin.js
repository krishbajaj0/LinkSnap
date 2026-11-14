import { Router } from 'express';
import { requireRole, requireTrustedWrite, requireUser } from '../auth/middleware.js';
import { createTokens } from '../auth/tokens.js';
import { HttpError } from '../http/errors.js';
import { Link } from '../links/model.js';
import { readPagination, validateLinkId } from '../links/validation.js';
import { assessDestination } from '../security/url-safety.js';
import { Report, reportStatuses } from './model.js';
import { readText } from './public.js';

const missing = () => new HttpError(404, 'MODERATION_ITEM_NOT_FOUND', 'Moderation item not found.');
const invalid = (message) => new HttpError(400, 'VALIDATION_ERROR', message);

function queue(request, allowed) {
  if (Object.entries(request.query).some(([key, value]) =>
    !['page', 'limit', ...allowed].includes(key) || typeof value !== 'string')) {
    throw invalid('Invalid moderation filters.');
  }
  return readPagination(request.query);
}

function publicToAdminLink(link, config) {
  let safety = { classification: 'blocked', flags: ['invalid-destination'] };
  let destination = null;
  try {
    const result = assessDestination(link.destination, config.prohibitedDomains);
    const url = new URL(result.destination);
    destination = url.origin + url.pathname;
    safety = { classification: result.classification, flags: result.flags };
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
  }
  return { id: link._id, shortCode: link.shortCode, destination, safety,
    blocked: link.securityBlocked, deleted: Boolean(link.deletedAt), reviewedAt: link.securityReviewedAt, updatedAt: link.updatedAt };
}

function readDecision(body, actions, extra = []) {
  if (!body || !actions.includes(body.action)
      || Object.keys(body).some((key) => !['action', 'note', ...extra].includes(key))) {
    throw invalid('Choose a valid moderation action.');
  }
  return { action: body.action, note: readText(body.note) };
}

export function createAdminRouter(config) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  if (!config.mongoUri || !config.authSecret) {
    router.use(() => { throw new HttpError(503, 'MODERATION_UNAVAILABLE', 'Moderation is unavailable.'); });
    return router;
  }
  router.use(requireUser(createTokens(config.authSecret)), requireRole('admin'), requireTrustedWrite(config.clientOrigins));
  router.param('id', (_request, _response, next, id) => {
    validateLinkId(id);
    next();
  });

  router.get('/reports', async (request, response) => {
    const { page, limit } = queue(request, ['status']);
    const { status = 'pending' } = request.query;
    if (status !== 'all' && !reportStatuses.includes(status)) throw invalid('Choose a valid report status.');
    const filter = status === 'all' ? {} : { status };
    const [items, total] = await Promise.all([
      Report.find(filter).select('-moderationHistory').sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Report.countDocuments(filter),
    ]);
    response.json({ success: true, data: { items, page, limit, total } });
  });

  router.get('/reports/:id', async (request, response) => {
    const report = await Report.findById(request.params.id).lean();
    if (!report) throw missing();
    const link = await Link.findById(report.linkId).select('shortCode destination securityBlocked deletedAt securityReviewedAt updatedAt').lean();
    response.json({ success: true, data: { report, link: link && publicToAdminLink(link, config) } });
  });

  router.patch('/reports/:id', async (request, response) => {
    const { action, note } = readDecision(request.body, ['review', 'dismiss', 'actioned']);
    const moderatorId = request.user._id;
    const status = action === 'review' ? 'reviewed' : action === 'dismiss' ? 'dismissed' : 'actioned';
    const filter = { _id: request.params.id, status: action === 'review' ? 'pending' : { $in: ['pending', 'reviewed'] } };
    const changed = await Report.updateOne(filter, {
      $set: { status, moderatorId, decision: action, notes: note },
      $push: { moderationHistory: { moderatorId, action, note, timestamp: new Date() } },
    });
    if (!changed.matchedCount) throw new HttpError(409, 'REPORT_STATE_CHANGED', 'This report is no longer eligible for that decision.');
    response.json({ success: true, data: { status } });
  });

  router.get('/links', async (request, response) => {
    const { page, limit } = queue(request, ['state']);
    const { state = 'flagged' } = request.query;
    if (!['flagged', 'blocked'].includes(state)) throw invalid('Choose a valid link filter.');
    const filter = state === 'blocked' ? { deletedAt: null, securityBlocked: true }
      : { deletedAt: null, 'securityFlags.0': { $exists: true }, securityBlocked: false, securityReviewedAt: null };
    const [items, total] = await Promise.all([
      Link.find(filter).select('shortCode destination securityBlocked deletedAt').sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Link.countDocuments(filter),
    ]);
    response.json({ success: true, data: { items: items.map((link) => publicToAdminLink(link, config)), page, limit, total } });
  });

  router.get('/links/:id', async (request, response) => {
    const link = await Link.findById(request.params.id).select('shortCode destination securityBlocked deletedAt securityReviewedAt updatedAt +moderationHistory').lean();
    if (!link) throw missing();
    response.json({ success: true, data: { ...publicToAdminLink(link, config), history: link.moderationHistory ?? [] } });
  });

  router.patch('/links/:id', async (request, response) => {
    const { action, note } = readDecision(request.body, ['block', 'unblock', 'review'], ['reportId', 'updatedAt']);
    const { reportId, updatedAt } = request.body;
    const linkId = request.params.id;
    if (reportId !== undefined) {
      if (typeof reportId !== 'string') throw invalid('Invalid report ID.');
      validateLinkId(reportId);
      if (!await Report.exists({ _id: reportId, linkId })) throw missing();
    }
    const blocked = action === 'block';
    const filter = { _id: linkId, deletedAt: null };
    const timestamp = new Date();
    let fields = { securityBlocked: blocked };
    if (action === 'review') {
      if (typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))) throw invalid('Missing link revision.');
      Object.assign(filter, { updatedAt: new Date(updatedAt), securityReviewedAt: null, 'securityFlags.0': { $exists: true } });
      fields = { securityReviewedAt: timestamp };
    } else {
      filter.securityBlocked = !blocked;
    }
    if (action === 'unblock') {
      const link = await Link.findOne(filter).select('destination').lean();
      if (!link) throw new HttpError(409, 'LINK_STATE_CHANGED', 'This link is no longer eligible for that action.');
      if (assessDestination(link.destination, config.prohibitedDomains).classification === 'blocked') {
        throw new HttpError(409, 'DESTINATION_PROHIBITED', 'The destination is still prohibited by policy.');
      }
      // Prevent an intervening destination edit from changing the policy decision.
      filter.destination = link.destination;
    }
    const changed = await Link.updateOne(filter, {
      $set: fields,
      $push: { moderationHistory: {
        moderatorId: request.user._id, reportId, action, note, timestamp,
      } },
    });
    if (!changed.matchedCount) throw new HttpError(409, 'LINK_STATE_CHANGED', 'This link is no longer eligible for that action.');
    response.json({ success: true, data: action === 'review' ? { reviewedAt: timestamp } : { blocked } });
  });

  return router;
}
