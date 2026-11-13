import { HttpError } from '../http/errors.js';
import { customCodePattern, isReservedCode } from './paths.js';

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
  const allowed = creating ? ['destination', 'alias', 'expiresAt'] : ['destination', 'expiresAt', 'enabled'];
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !allowed.includes(key))) {
    throw invalid(creating ? 'Send destination, optional alias and optional expiration.' : 'Only destination, expiration and enabled status can be edited.');
  }

  const fields = {};
  if (creating || Object.hasOwn(body, 'destination')) fields.destination = normalizeDestination(body.destination);
  if (Object.hasOwn(body, 'expiresAt')) fields.expiresAt = expiration(body.expiresAt);
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
