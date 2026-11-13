import { Link } from './model.js';
import { serializeLink } from './service.js';
import { maxTags } from './tags.js';

export const linkSorts = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  updated: { updatedAt: -1, _id: -1 },
  expiration: { expiresAt: -1, _id: -1 },
  code: { shortCode: 1 },
};

export function statusFilters(now) {
  return {
    active: { securityBlocked: false, enabled: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    disabled: { securityBlocked: false, enabled: false },
    expired: { securityBlocked: false, enabled: true, expiresAt: { $lte: now } },
    'security-blocked': { securityBlocked: true },
  };
}

export async function listLinks(owned, query) {
  const { page, limit, sort, search, status, tag, createdFrom, createdTo } = query;
  const now = new Date();
  const filters = [owned];
  if (status) filters.push(statusFilters(now)[status]);
  if (tag) filters.push({ tags: tag });
  if (createdFrom || createdTo) {
    filters.push({ createdAt: {
      ...(createdFrom && { $gte: createdFrom }),
      ...(createdTo && { $lt: createdTo }),
    } });
  }
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(literal, 'i');
    filters.push({ $or: [{ shortCode: match }, { destination: match }, { tags: match }] });
  }
  const filter = { $and: filters };
  const [links, total, hasLinks] = await Promise.all([
    Link.find(filter).sort(linkSorts[sort]).skip((page - 1) * limit).limit(limit).lean(),
    Link.countDocuments(filter),
    filters.length === 1 ? null : Link.exists(owned),
  ]);
  return { links: links.map((link) => serializeLink(link, now)), page, limit, total, hasLinks: Boolean(total || hasLinks) };
}

export async function dashboardOverview(owned) {
  const now = new Date();
  const since = new Date(+now - 7 * 24 * 60 * 60 * 1000);
  const count = (field) => [{ $match: { [field]: { $gte: since } } }, { $count: 'count' }];
  const statuses = Object.fromEntries(Object.entries(statusFilters(now)).map(([status, filter]) =>
    [status, [{ $match: filter }, { $count: 'count' }]]));
  const [[counts], newest, updated] = await Promise.all([
    Link.aggregate([
      { $match: owned },
      { $facet: { total: [{ $count: 'count' }], ...statuses, recentlyCreated: count('createdAt'), recentlyUpdated: count('updatedAt') } },
    ]),
    Link.find(owned).sort(linkSorts.newest).limit(5).lean(),
    Link.find(owned).sort(linkSorts.updated).limit(5).lean(),
  ]);
  return {
    counts: Object.fromEntries(Object.entries(counts).map(([name, result]) => [name, result[0]?.count ?? 0])),
    newest: newest.map((link) => serializeLink(link, now)),
    updated: updated.map((link) => serializeLink(link, now)),
  };
}

export async function bulkUpdateLinks(owned, { ids, action, tag }) {
  const filter = { ...owned, _id: { $in: ids } };
  let update;

  switch (action) {
    case 'enable':
      Object.assign(filter, { securityBlocked: false, enabled: false });
      update = { $set: { enabled: true } };
      break;
    case 'disable':
      filter.enabled = true;
      update = { $set: { enabled: false } };
      break;
    case 'delete':
      update = { $set: { deletedAt: new Date() } };
      break;
    case 'add-tag':
      filter.tags = { $ne: tag };
      filter.$expr = { $lt: [{ $size: { $ifNull: ['$tags', []] } }, maxTags] };
      update = { $addToSet: { tags: tag } };
      break;
    case 'remove-tag':
      filter.tags = tag;
      update = { $pull: { tags: tag } };
      break;
  }

  // The owner, lifecycle and tag-limit checks apply atomically to each document.
  const { modifiedCount } = await Link.updateMany(filter, update);
  return { requested: ids.length, changed: modifiedCount, skipped: ids.length - modifiedCount };
}
