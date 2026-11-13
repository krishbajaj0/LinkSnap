import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
export const refreshOverlap = 10_000;
const jwtClaims = { issuer: 'linksnap', audience: 'linksnap-api' };

export function createTokens(secret) {
  const accessKey = createHmac('sha256', secret).update('linksnap/access/v1').digest();
  const refreshKey = createHmac('sha256', secret).update('linksnap/refresh/v1').digest();
  const signRefresh = (payload) => createHmac('sha256', refreshKey).update(payload).digest();

  return {
    access(user, session) {
      return jwt.sign({ sid: String(session._id) }, accessKey, {
        ...jwtClaims,
        algorithm: 'HS256',
        subject: String(user._id),
        expiresIn: 900,
      });
    },
    verifyAccess(token) {
      return jwt.verify(token, accessKey, { ...jwtClaims, algorithms: ['HS256'] });
    },
    refresh(id, generation) {
      const payload = `${id}.${generation}.${randomBytes(32).toString('base64url')}`;
      return `${payload}.${signRefresh(payload).toString('base64url')}`;
    },
    verifyRefresh(token) {
      if (typeof token !== 'string' || !/^[a-f0-9]{24}\.\d{1,9}\.[\w-]{43}\.[\w-]{43}$/.test(token)) return null;
      const separator = token.lastIndexOf('.');
      const signature = Buffer.from(token.slice(separator + 1), 'base64url');
      const payload = token.slice(0, separator);
      if (!timingSafeEqual(signRefresh(payload), signature) || signature.toString('base64url') !== token.slice(separator + 1)) {
        return null;
      }
      const [id, generation] = payload.split('.');
      return { id, generation: Number(generation) };
    },
  };
}

export function hashRefresh(token) {
  return createHash('sha256').update(token).digest('hex');
}
