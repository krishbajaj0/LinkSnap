import { Router } from 'express';
import { requireUser } from '../auth/middleware.js';
import { createTokens } from '../auth/tokens.js';
import { HttpError } from '../http/errors.js';
import { Link } from './model.js';
import { createLink, serializeLink } from './service.js';
import { readLinkInput, readPagination, validateLinkId } from './validation.js';

const missing = () => new HttpError(404, 'LINK_NOT_FOUND', 'Link not found.');
const owned = (request) => ({ ownerId: request.user._id, deletedAt: null });

export function createLinksRouter(config, generateCode) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  if (!config.mongoUri || !config.authSecret) {
    router.use(() => { throw new HttpError(503, 'LINKS_UNAVAILABLE', 'Link management is unavailable.'); });
    return router;
  }

  router.use(requireUser(createTokens(config.authSecret)));

  router.post('/', async (request, response) => {
    const link = await createLink(request.user._id, readLinkInput(request.body, true), generateCode);
    response.status(201).json({ success: true, data: serializeLink(link) });
  });

  router.get('/', async (request, response) => {
    const { page, limit } = readPagination(request.query);
    const filter = owned(request);
    const [links, total] = await Promise.all([
      Link.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Link.countDocuments(filter),
    ]);
    response.json({ success: true, data: { links: links.map(serializeLink), page, limit, total } });
  });

  router.param('id', (request, _response, next, id) => {
    validateLinkId(id);
    request.linkFilter = { ...owned(request), _id: id };
    next();
  });

  router.get('/:id', async (request, response) => {
    const link = await Link.findOne(request.linkFilter).lean();
    if (!link) throw missing();
    response.json({ success: true, data: serializeLink(link) });
  });

  router.patch('/:id', async (request, response) => {
    const fields = readLinkInput(request.body, false);
    const link = await Link.findOneAndUpdate(request.linkFilter, { $set: fields }, {
      returnDocument: 'after', runValidators: true,
    }).lean();
    if (!link) throw missing();
    response.json({ success: true, data: serializeLink(link) });
  });

  router.delete('/:id', async (request, response) => {
    const result = await Link.updateOne(request.linkFilter, { $set: { deletedAt: new Date() } });
    if (!result.matchedCount) throw missing();
    response.json({ success: true, data: null });
  });

  return router;
}
