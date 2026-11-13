import { customAlphabet } from 'nanoid';
import { HttpError } from '../http/errors.js';
import { Link } from './model.js';
import { automaticCodePattern, isReservedCode } from './paths.js';

export const generateShortCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 8);

export function linkStatus(link, now = new Date()) {
  if (link.deletedAt) return 'deleted';
  if (link.securityBlocked) return 'security-blocked';
  if (!link.enabled) return 'disabled';
  if (link.expiresAt && link.expiresAt <= now) return 'expired';
  return 'active';
}

export function serializeLink(link) {
  const { _id, destination, shortCode, codeType, expiresAt, enabled, createdAt, updatedAt } = link;
  return {
    id: String(_id), destination, shortCode, shortPath: `/${shortCode}`,
    codeType, expiresAt, enabled, status: linkStatus(link), createdAt, updatedAt,
  };
}

export async function createLink(ownerId, input, generateCode = generateShortCode) {
  const { alias, ...fields } = input;
  for (let attempt = 0; attempt < (alias ? 1 : 5); attempt += 1) {
    const shortCode = alias ?? generateCode();
    if (!alias && (!automaticCodePattern.test(shortCode) || isReservedCode(shortCode))) continue;
    try {
      return await Link.create({ ...fields, ownerId, shortCode, codeType: alias ? 'custom' : 'automatic' });
    } catch (error) {
      if (error.code !== 11000 || !error.keyPattern?.shortCode) throw error;
      if (alias) throw new HttpError(409, 'ALIAS_UNAVAILABLE', 'This alias is unavailable.');
    }
  }
  throw new HttpError(503, 'CODE_GENERATION_FAILED', 'Could not reserve a short code. Try again.');
}
