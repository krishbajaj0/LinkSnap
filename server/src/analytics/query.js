import { HttpError } from '../http/errors.js';
import { Link } from '../links/model.js';
import { ClickEvent, dayMs, retentionDays } from './model.js';

export const exportLimit = 5000;
const dimensions = ['device', 'browser', 'os', 'country', 'referrer'];
const invalid = (message) => new HttpError(400, 'VALIDATION_ERROR', message);

function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid('Use YYYY-MM-DD dates in UTC.');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) throw invalid('Use valid calendar dates.');
  return +date;
}

export function readRange(query, now = new Date()) {
  const keys = ['from', 'to', 'interval', 'traffic'];
  if (Object.entries(query).some(([key, value]) => !keys.includes(key) || typeof value !== 'string')) {
    throw invalid('Invalid analytics query.');
  }
  const { interval = 'day', traffic = 'all' } = query;
  if (!['day', 'hour'].includes(interval) || !['all', 'human', 'bot'].includes(traffic)) {
    throw invalid('Invalid analytics interval or traffic filter.');
  }
  const today = Math.floor(+now / dayMs) * dayMs;
  const first = today - (retentionDays - 1) * dayMs;
  const last = query.to === undefined ? today : parseDay(query.to);
  const start = query.from === undefined ? Math.max(first, last - (interval === 'hour' ? 0 : 29) * dayMs) : parseDay(query.from);
  const days = (last - start) / dayMs + 1;
  if (last > today || start < first || days < 1 || days > (interval === 'hour' ? 7 : retentionDays)) {
    throw invalid('Select up to 90 days within retention, or up to 7 days for hourly trends.');
  }
  return { start: new Date(start), end: new Date(Math.min(last + dayMs, +now)), interval, traffic };
}

export function eventFilter(owned, range) {
  return { ...owned, timestamp: { $gte: range.start, $lt: range.end },
    ...(range.traffic !== 'all' && { bot: range.traffic === 'bot' }) };
}

const grouping = (key, limit) => [
  { $group: { _id: key, clicks: { $sum: 1 } } },
  { $sort: { clicks: -1, _id: 1 } },
  { $limit: limit },
];

export async function summarize(owned, range, visitorEnabled) {
  const lifetimeFilter = owned.linkId ? { ownerId: owned.ownerId, _id: owned.linkId } : { ownerId: owned.ownerId };
  const query = ClickEvent.aggregate([
    { $match: eventFilter(owned, range) },
    { $facet: {
      totals: [{ $group: { _id: null, total: { $sum: 1 }, bot: { $sum: { $cond: ['$bot', 1, 0] } } } }],
      trends: [
        { $group: { _id: { $dateTrunc: { date: '$timestamp', unit: range.interval, timezone: 'UTC' } }, clicks: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ],
      ...Object.fromEntries(dimensions.map((field) => [field, grouping('$' + field, 12)])),
      ...(owned.linkId ? {} : { top: grouping('$linkId', 10) }),
    } },
  ]).option({ maxTimeMS: 5000 });
  // Keep potentially high-cardinality visitor grouping out of the facet's memory limit.
  const uniqueQuery = visitorEnabled && range.traffic !== 'bot' ? ClickEvent.aggregate([
    { $match: { ...eventFilter(owned, range), visitorId: { $type: 'string' } } },
    { $group: { _id: '$visitorId', events: { $sum: 1 } } },
    { $group: { _id: null, count: { $sum: 1 }, events: { $sum: '$events' } } },
  ]).allowDiskUse(true).option({ maxTimeMS: 5000 }) : [];
  const [[results], [lifetime], [unique]] = await Promise.all([
    query,
    Link.aggregate([
      { $match: lifetimeFilter },
      { $group: { _id: null, total: { $sum: '$lifetimeClicks' }, bot: { $sum: '$lifetimeBotClicks' },
        human: { $sum: '$lifetimeHumanClicks' } } },
      { $project: { _id: 0 } },
    ]).option({ maxTimeMS: 5000 }),
    uniqueQuery,
  ]);
  const { total = 0, bot = 0 } = results.totals[0] ?? {};
  const step = range.interval === 'hour' ? 3_600_000 : dayMs;
  const countsByTime = new Map(results.trends.map((row) => [+row._id, row.clicks]));
  const trends = [];
  for (let date = +range.start; date < +range.end; date += step) {
    trends.push({ timestamp: new Date(date), clicks: countsByTime.get(date) ?? 0 });
  }

  const top = results.top ?? [];
  const links = top.length ? await Link.find({
    ownerId: owned.ownerId, _id: { $in: top.map((row) => row._id) },
  }).select('shortCode deletedAt').maxTimeMS(5000).lean() : [];
  const byId = new Map(links.map((link) => [String(link._id), link]));
  return {
    range: { from: range.start, toExclusive: range.end, interval: range.interval, traffic: range.traffic },
    counts: { total, bot, human: total - bot },
    lifetime: lifetime ?? { total: 0, bot: 0, human: 0 },
    visitors: { approximate: unique?.count ?? null, identifiedClicks: unique?.events ?? 0, enabled: visitorEnabled },
    trends,
    breakdowns: Object.fromEntries(dimensions.map((field) => [field, results[field].map(({ _id, clicks }) => ({ label: _id, clicks }))])),
    topLinks: top.flatMap(({ _id, clicks }) => {
      const link = byId.get(String(_id));
      return link ? [{ id: String(_id), shortCode: link.shortCode, deleted: Boolean(link.deletedAt), clicks }] : [];
    }),
  };
}

export function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export async function exportEvents(owned, range) {
  const rows = await ClickEvent.find(eventFilter(owned, range))
    .select('timestamp linkId device browser os country referrer bot -_id')
    .sort({ timestamp: -1, _id: -1 }).limit(exportLimit + 1).maxTimeMS(5000).lean();
  const truncated = rows.length > exportLimit;
  if (truncated) rows.pop();
  const links = await Link.find({
    ownerId: owned.ownerId, _id: { $in: [...new Set(rows.map((row) => String(row.linkId)))] },
  }).select('shortCode').maxTimeMS(5000).lean();
  const codes = new Map(links.map((link) => [String(link._id), link.shortCode]));
  const header = 'timestamp_utc,short_code,device,browser,os,country,referrer,is_bot';
  const lines = rows.map((row) => [
    row.timestamp.toISOString(), codes.get(String(row.linkId)), row.device, row.browser, row.os,
    row.country, row.referrer, row.bot,
  ].map(csvCell).join(','));
  return { csv: [header, ...lines].join('\r\n') + '\r\n', truncated };
}
