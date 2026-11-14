import { HttpError } from '../http/errors.js';
import { emailPattern } from './models.js';

function invalid(message) {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

export function readProfileName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 80) throw invalid('Enter a name up to 80 characters.');
  return name;
}

export function readCredentials(body, registering = false) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !emailPattern.test(email) || email.split('@')[0].length > 64) {
    throw invalid('Enter a valid email address.');
  }
  const name = registering ? readProfileName(body?.name) : undefined;
  return { email, name, password: readPassword(body?.password, registering) };
}

export function readPassword(password, isNew = false) {
  if (typeof password !== 'string' || !password.length || password.includes('\0')
      || Buffer.byteLength(password, 'utf8') > 72 || (isNew && [...password].length < 12)) {
    throw invalid(isNew ? 'Use at least 12 characters and no more than 72 UTF-8 bytes.' : 'Enter a valid password.');
  }
  return password;
}
