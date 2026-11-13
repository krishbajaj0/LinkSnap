import { HttpError } from '../http/errors.js';
import { customCodePattern, isReservedCode } from './paths.js';
import { normalizeTag, readTags } from './tags.js';

const invalid = (message) => new HttpError(400, 'VALIDATION_ERROR', message);

export const maxDestinationLength = 2048;

export function normalizeDestination(input) {
  if (typeof input !== 'string' || input.length > maxDestinationLength || /[\u0000-\u001f\u007f\\]/.test(input)) {
    throw invalid('Enter an HTTP or HTTPS URL up to 2048 characters.');
  }
  const value = input.trim();
  const authority = /^https?:\/\/([^/?#]+)/i.exec(value)?.[1];
  const parsed = URL.parse(value);
  if (!authority || authority.includes('@') || /\s/.test(value) || !parsed?.hostname
      || !['http:', 'https:'].includes(parsed.protocol) || parsed.href.length > maxDestinationLength) {
    throw invalid('Enter a valid HTTP or HTTPS URL without embedded credentials.');
  }
  return parsed.href;
}

function expiration(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw invalid('Expiration must be a future UTC ISO timestamp or null.');
  }
  const date = new Date(value);
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(+date) || date.toISOString() !== canonical || +date <= Date.now()) {
    throw invalid('Expiration must be a valid date in the future.');
  }
  return date;
}

export function validateLinkId(id) {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw invalid('Invalid link ID.');
}

export function readLinkInput(body, creating) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Send a JSON object.');
  const allowed = creating ? ['destination', 'alias', 'expiresAt', 'tags'] : ['destination', 'expiresAt', 'enabled', 'tags'];
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !allowed.includes(key))) {
    throw invalid(creating ? 'Send destination, optional alias, expiration and tags.' : 'Only destination, expiration, enabled status and tags can be edited.');
  }

  const fields = {};
  if (creating || Object.hasOwn(body, 'destination')) fields.destination = normalizeDestination(body.destination);
  if (Object.hasOwn(body, 'expiresAt')) fields.expiresAt = expiration(body.expiresAt);
  if (Object.hasOwn(body, 'tags')) fields.tags = readTags(body.tags);
  if (Object.hasOwn(body, 'alias')) {
    if (typeof body.alias !== 'string' || !customCodePattern.test(body.alias) || isReservedCode(body.alias)) {
      throw invalid('Alias must be 4–32 lowercase letters, digits or hyphens and cannot be reserved.');
    }
    fields.alias = body.alias;
  }
  if (Object.hasOwn(body, 'enabled')) {
    if (typeof body.enabled !== 'boolean') throw invalid('Enabled must be a boolean.');
    fields.enabled = body.enabled;
  }
  return fields;
}

export function readPagination(query) {
  const { page = '1', limit = '10' } = query;
  if (typeof page !== 'string' || typeof limit !== 'string' || !/^\d{1,4}$/.test(page)
      || !/^\d{1,2}$/.test(limit) || +page < 1 || +page > 1000 || +limit < 1 || +limit > 50) {
    throw invalid('Page must be 1–1000 and limit must be 1–50.');
  }
  return { page: +page, limit: +limit };
}

function readDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid('Use YYYY-MM-DD for date filters.');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) {
    throw invalid('Use a valid calendar date.');
  }
  return date;
}

export function readLinkQuery(query, sorts, statuses) {
  const allowed = ['page', 'limit', 'sort', 'status', 'tag', 'search', 'createdFrom', 'createdTo'];
  if (Object.entries(query).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')) {
    throw invalid('Invalid link query parameters.');
  }
  const { sort = 'newest', status, tag } = query;
  if (!Object.hasOwn(sorts, sort) || (status && !Object.hasOwn(statuses, status))) {
    throw invalid('Invalid link status or sort order.');
  }
  const search = query.search?.trim();
  if (search?.length > 100 || /[\u0000-\u001f\u007f]/.test(search ?? '')) {
    throw invalid('Search must be at most 100 characters and contain no control characters.');
  }
  const createdFrom = query.createdFrom ? readDate(query.createdFrom) : undefined;
  const lastDay = query.createdTo ? readDate(query.createdTo) : undefined;
  if (createdFrom && lastDay && createdFrom > lastDay) throw invalid('Start date must be on or before the end date.');
  const createdTo = lastDay ? new Date(+lastDay + 86_400_000) : undefined;
  return { ...readPagination(query), sort, status, search, tag: tag ? normalizeTag(tag) : undefined, createdFrom, createdTo };
}

export function readBulkInput(body) {
  const actions = ['enable', 'disable', 'delete', 'add-tag', 'remove-tag'];
  const { action, ids, tag } = body ?? {};
  if (!actions.includes(action) || !Array.isArray(ids) || !ids.length || ids.length > 50
      || ids.some((id) => typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id))) {
    throw invalid('Choose a valid action and 1–50 link IDs.');
  }
  const usesTag = action === 'add-tag' || action === 'remove-tag';
  if (Object.keys(body).some((key) => !['action', 'ids', ...(usesTag ? ['tag'] : [])].includes(key))) {
    throw invalid('Unexpected bulk action fields.');
  }
  return { action, ids: [...new Set(ids.map((id) => id.toLowerCase()))], tag: usesTag ? normalizeTag(tag) : undefined };
}
