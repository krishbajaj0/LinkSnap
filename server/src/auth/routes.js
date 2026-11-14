import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../http/errors.js';
import { requireTrustedWrite, requireUser } from './middleware.js';
import { User } from './models.js';
import { revokeOlderSessions, revokeSession, rotateSession, startSession } from './session-service.js';
import { createTokens } from './tokens.js';
import { readCredentials, readPassword, readProfileName } from './validation.js';

const passwordCost = 12;
let dummyHash;

function profile(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

function limitWrites(limit, skipSuccessfulRequests = false) {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => {
      next(new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many attempts. Try again later.'));
    },
  });
}

export function createAuthRouter(config) {
  const router = Router();
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  if (!config.authSecret || !config.mongoUri) {
    router.use(() => { throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is unavailable.'); });
    return router;
  }

  const tokens = createTokens(config.authSecret);
  const authenticated = requireUser(tokens);
  const secure = config.environment === 'production';
  const cookieName = secure ? '__Host-linksnap_refresh' : 'linksnap_refresh';
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: secure ? '/' : '/api/v1/auth' };
  router.use(requireTrustedWrite(config.clientOrigins), cookieParser());

  function sendSession(response, result, status = 200) {
    const { user, session, refreshToken } = result;
    response.cookie(cookieName, refreshToken, { ...cookieOptions, expires: session.expiresAt });
    response.status(status).json({
      success: true, data: { user: profile(user), accessToken: tokens.access(user, session) },
    });
  }

  function endSession(response) {
    response.clearCookie(cookieName, cookieOptions);
    response.json({ success: true, data: null });
  }

  router.post('/register', limitWrites(8), async (request, response) => {
    const { email, name, password } = readCredentials(request.body, true);
    const passwordHash = await bcrypt.hash(password, passwordCost);
    let user;
    try {
      user = await User.create({ email, name, passwordHash });
    } catch (error) {
      if (error.code !== 11000) throw error;
      throw new HttpError(409, 'REGISTRATION_FAILED', 'Unable to create an account with these details.');
    }
    sendSession(response, await startSession(user, tokens), 201);
  });

  router.post('/login', limitWrites(12, true), async (request, response) => {
    const { email, password } = readCredentials(request.body);
    const [user, fallbackHash] = await Promise.all([
      User.findOne({ email }).select('+passwordHash'),
      dummyHash ??= bcrypt.hash(randomBytes(32).toString('hex'), passwordCost),
    ]);
    const hash = user?.passwordHash ?? fallbackHash;
    if (!(await bcrypt.compare(password, hash)) || !user) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    sendSession(response, await startSession(user, tokens));
  });

  router.post('/refresh', limitWrites(60), async (request, response) => {
    sendSession(response, await rotateSession(request.cookies[cookieName], tokens));
  });

  router.post('/logout', async (request, response) => {
    await revokeSession(request.cookies[cookieName], tokens);
    endSession(response);
  });

  router.get('/me', authenticated, (request, response) => {
    response.json({ success: true, data: { user: profile(request.user) } });
  });

  router.patch('/me', authenticated, async (request, response) => {
    if (Object.keys(request.body ?? {}).some((key) => key !== 'name')) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Only the profile name can be changed.');
    }
    const name = readProfileName(request.body?.name);
    const user = await User.findOneAndUpdate(
      { _id: request.user._id, sessionVersion: request.user.sessionVersion },
      { $set: { name } }, { returnDocument: 'after', runValidators: true },
    );
    if (!user) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Account changed. Sign in again.');
    response.json({ success: true, data: { user: profile(user) } });
  });

  router.post('/logout-all', authenticated, async (request, response) => {
    const user = await User.findByIdAndUpdate(
      request.user._id, { $inc: { sessionVersion: 1 } }, { returnDocument: 'after' },
    );
    await revokeOlderSessions(user._id, user.sessionVersion);
    endSession(response);
  });

  router.patch('/change-password', authenticated, limitWrites(8, true), async (request, response) => {
    const currentPassword = readPassword(request.body?.currentPassword);
    const newPassword = readPassword(request.body?.newPassword, true);
    const user = await User.findById(request.user._id).select('+passwordHash');
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
    }
    if (currentPassword === newPassword) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a different password.');
    }
    const passwordHash = await bcrypt.hash(newPassword, passwordCost);
    const updated = await User.findOneAndUpdate(
      { _id: user._id, passwordHash: user.passwordHash, sessionVersion: request.user.sessionVersion },
      { $set: { passwordHash }, $inc: { sessionVersion: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Account changed. Sign in again.');
    await revokeOlderSessions(updated._id, updated.sessionVersion);
    endSession(response);
  });

  return router;
}
