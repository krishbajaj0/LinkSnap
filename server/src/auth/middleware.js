import { HttpError } from '../http/errors.js';
import { Session, User } from './models.js';
import { unauthorized } from './session-service.js';

export function requireUser(tokens) {
  return async (request, _response, next) => {
    const token = /^Bearer (\S+)$/i.exec(request.get('Authorization') ?? '')?.[1];
    if (!token || token.length > 2048) throw unauthorized();

    let claims;
    try {
      claims = tokens.verifyAccess(token);
    } catch {
      throw unauthorized();
    }
    if (!/^[a-f0-9]{24}$/.test(claims?.sub) || !/^[a-f0-9]{24}$/.test(claims?.sid)) {
      throw unauthorized();
    }

    const session = await Session.findOne({
      _id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { $gt: new Date() },
    });
    if (!session) throw unauthorized();
    const user = await User.findOne({ _id: claims.sub, sessionVersion: session.sessionVersion });
    if (!user) throw unauthorized();

    request.user = user;
    next();
  };
}

export function requireRole(role) {
  return (request, _response, next) => {
    if (!request.user) throw unauthorized();
    if (request.user.role !== role) throw new HttpError(403, 'FORBIDDEN', 'Access denied.');
    next();
  };
}

export function requireTrustedWrite(origins) {
  return (request, _response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    if (!origins.has(request.get('Origin')) || request.get('X-LinkSnap-CSRF') !== '1') {
      throw new HttpError(403, 'CSRF_REJECTED', 'Request origin could not be verified.');
    }
    next();
  };
}
