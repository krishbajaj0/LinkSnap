import { Types } from 'mongoose';
import { HttpError } from '../http/errors.js';
import { Session, User } from './models.js';
import { hashRefresh, refreshOverlap, sessionLifetime } from './tokens.js';

export const unauthorized = () => new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');

export async function startSession(user, tokens) {
  const id = new Types.ObjectId();
  const refreshToken = tokens.refresh(id, 0);
  const session = await Session.create({
    _id: id,
    userId: user._id,
    sessionVersion: user.sessionVersion,
    tokenHash: hashRefresh(refreshToken),
    generation: 0,
    expiresAt: new Date(Date.now() + sessionLifetime),
  });
  return { user, session, refreshToken };
}

export async function rotateSession(rawToken, tokens) {
  const claims = tokens.verifyRefresh(rawToken);
  if (!claims) throw unauthorized();

  const now = new Date();
  const active = { _id: claims.id, revokedAt: null, expiresAt: { $gt: now } };
  const refreshToken = tokens.refresh(claims.id, claims.generation + 1);
  const session = await Session.findOneAndUpdate(
    { ...active, generation: claims.generation, tokenHash: hashRefresh(rawToken) },
    { $set: { tokenHash: hashRefresh(refreshToken), rotatedAt: now }, $inc: { generation: 1 } },
    { returnDocument: 'after' },
  );

  if (session) {
    const user = await User.findOne({ _id: session.userId, sessionVersion: session.sessionVersion });
    if (!user) throw unauthorized();
    return { user, session, refreshToken };
  }

  const current = await Session.findOne(active);
  if (!current || claims.generation >= current.generation) throw unauthorized();

  // Only an authentic immediate predecessor can be treated as a concurrent duplicate.
  if (claims.generation === current.generation - 1 && Date.now() - current.rotatedAt.getTime() < refreshOverlap) {
    throw new HttpError(409, 'REFRESH_CONFLICT', 'Session refresh already in progress. Try again.');
  }

  await Session.updateOne(active, { $set: { revokedAt: new Date() } });
  throw unauthorized();
}

export async function revokeSession(rawToken, tokens) {
  const claims = tokens.verifyRefresh(rawToken);
  if (!claims) return;
  await Session.updateOne(
    { _id: claims.id, generation: { $gte: claims.generation }, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export function revokeOlderSessions(userId, sessionVersion) {
  return Session.updateMany(
    { userId, sessionVersion: { $lt: sessionVersion }, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
