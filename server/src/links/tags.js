import { HttpError } from '../http/errors.js';

export const maxTags = 10;
const tagPattern = /^[a-z0-9]+(?:[ -][a-z0-9]+)*$/;

export function isTag(value) {
  return typeof value === 'string' && value.length <= 32 && tagPattern.test(value);
}

export function normalizeTag(value) {
  const tag = typeof value === 'string' ? value.trim().toLowerCase().replace(/ +/g, ' ') : '';
  if (!isTag(tag)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Use 1–32 letters, digits, spaces or hyphens per tag.');
  }
  return tag;
}

export function readTags(value) {
  if (!Array.isArray(value) || value.length > maxTags) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Send an array of up to 10 tags.');
  }
  return [...new Set(value.map(normalizeTag))];
}
