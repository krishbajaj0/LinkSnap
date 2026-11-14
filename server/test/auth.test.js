import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import bcrypt from 'bcrypt';
import express from 'express';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { requireRole, requireUser } from '../src/auth/middleware.js';
import { Session, User } from '../src/auth/models.js';
import { createTokens, hashRefresh, refreshOverlap, sessionLifetime } from '../src/auth/tokens.js';
import { readConfig } from '../src/config/env.js';
import { handleError } from '../src/http/errors.js';

const password = 'Test password phrase 123';
const newPassword = 'Different password phrase 456';
const origin = 'http://localhost:5173';
const secureOrigin = 'https://linksnap.example';

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

function requestFrom(base, clientOrigin = origin) {
  return async (path, { method = 'GET', body, token, cookie, headers = {} } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: clientOrigin,
        'X-LinkSnap-CSRF': '1',
        ...(body && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: 'Bearer ' + token }),
        ...(cookie && { Cookie: cookie }),
        ...headers,
      },
      body: body && JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    const payload = await response.json();
    return { status: response.status, headers: response.headers, setCookie, cookie: setCookie?.split(';')[0], ...payload };
  };
}

test('authentication against an isolated local MongoDB database', async (t) => {
  const port = process.env.LINKSNAP_TEST_MONGO_PORT ?? '27017';
  assert.match(port, /^\d{1,5}$/);
  const dbName = 'linksnap_auth_test_' + randomUUID().replaceAll('-', '');
  const mongoUri = 'mongodb://127.0.0.1:' + port + '/' + dbName;
  const secret = randomBytes(32).toString('hex');
  const config = readConfig({ NODE_ENV: 'test', AUTH_SECRET: secret, MONGODB_URI: mongoUri });
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    try {
      assert.equal(mongoose.connection.name, dbName);
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });
  await Promise.all([User.init(), Session.init()]);

  const app = express();
  app.get('/test/admin', requireUser(createTokens(config.authSecret)), requireRole('admin'),
    (_request, response) => response.json({ success: true }));
  app.use(createApp(config));
  app.use(handleError);
  const request = requestFrom(await listen(t, app));
  const auth = (path, options) => request('/api/v1/auth/' + path, options);
  const email = 'phase4@example.test';
  const register = (body) => auth('register', { method: 'POST', body });
  const login = (body = { email, password }) => auth('login', { method: 'POST', body });
  const refresh = (cookie) => auth('refresh', { method: 'POST', cookie });
  const me = (token) => auth('me', { token });
  let initial;

  await t.test('validation rejects invalid email, short password, and bcrypt overflow', async () => {
    for (const body of [
      { name: 'Test', email: 'invalid', password },
      { name: 'Test', email, password: 'short' },
      { name: 'Test', email, password: 'é'.repeat(40) },
    ]) {
      assert.equal((await register(body)).status, 400);
    }
  });

  await t.test('registration normalizes email, hashes password, and ignores requested role', async () => {
    initial = await register({ name: 'Test User', email: '  PHASE4@EXAMPLE.TEST ', password, role: 'admin' });
    assert.equal(initial.status, 201);
    assert.deepEqual(initial.data.user, { id: initial.data.user.id, name: 'Test User', email, role: 'user' });
    assert.match(initial.setCookie, /HttpOnly/);
    assert.match(initial.setCookie, /SameSite=Lax/);
    assert.match(initial.setCookie, /Path=\/api\/v1\/auth/);
    assert.doesNotMatch(initial.setCookie, /; Secure/);
    const user = await User.findById(initial.data.user.id).select('+passwordHash');
    assert.notEqual(user.passwordHash, password);
    assert.ok(await bcrypt.compare(password, user.passwordHash));
    assert.equal(bcrypt.getRounds(user.passwordHash), 12);
    const session = await Session.findOne({ userId: user._id }).select('+tokenHash');
    assert.equal(session.tokenHash, hashRefresh(initial.cookie.split('=')[1]));
    assert.deepEqual(Object.keys(initial.data).sort(), ['accessToken', 'user']);
  });

  await t.test('unique normalized email is rejected', async () => {
    const result = await register({ name: 'Duplicate', email: email.toUpperCase(), password });
    assert.equal(result.status, 409);
    assert.equal(result.error.code, 'REGISTRATION_FAILED');
    assert.equal(await User.countDocuments(), 1);
  });

  await t.test('valid login works; incorrect and unknown credentials give the same response', async () => {
    assert.equal((await login()).status, 200);
    const wrong = await login({ email, password: 'incorrect password' });
    const unknown = await login({ email: 'missing@example.test', password });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.error, unknown.error);
  });

  await t.test('profile, expiry, and admin middleware enforce authentication and role', async () => {
    assert.equal((await me()).status, 401);
    assert.equal((await me(initial.data.accessToken)).data.user.email, email);
    const user = await User.findById(initial.data.user.id);
    const session = await Session.findOne({ userId: user._id });
    const now = Date.now;
    let expired;
    try {
      Date.now = () => now() - 16 * 60_000;
      expired = createTokens(config.authSecret).access(user, session);
    } finally {
      Date.now = now;
    }
    assert.equal((await me(expired)).status, 401);
    assert.equal((await request('/test/admin', { token: initial.data.accessToken })).status, 403);
    await User.updateOne({ _id: user._id }, { role: 'admin' });
    assert.equal((await request('/test/admin', { token: initial.data.accessToken })).status, 200);
    await User.updateOne({ _id: user._id }, { role: 'user' });
  });

  await t.test('profile update validates fields and persists only the account name', async () => {
    const token = initial.data.accessToken;
    const rename = (body, options = {}) => auth('me', { method: 'PATCH', token, body, ...options });
    assert.equal((await rename({ name: 'Guest' }, { token: undefined })).status, 401);
    assert.equal((await rename({ name: 'Guest' }, { headers: { 'X-LinkSnap-CSRF': '' } })).status, 403);
    for (const body of [
      { name: '' }, { name: ' '.repeat(5) }, { name: 'a'.repeat(81) }, { name: ['Name'] },
      { name: 'Guest', role: 'admin' }, { name: 'Guest', email: 'other@example.test' },
    ]) {
      assert.equal((await rename(body)).status, 400);
    }
    const result = await rename({ name: '  Updated name  ' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.user, { ...initial.data.user, name: 'Updated name' });
    assert.equal(result.setCookie, null);
    assert.deepEqual((await me(token)).data.user, result.data.user);
  });

  await t.test('concurrent refresh rotates once; old token later revokes the family; expiry stays fixed', async () => {
    const id = initial.cookie.split('=')[1].split('.')[0];
    const original = await Session.findById(id);
    assert.ok(Math.abs(original.expiresAt - original.createdAt - sessionLifetime) < 1000);
    const results = await Promise.all([refresh(initial.cookie), refresh(initial.cookie)]);
    const [winner, duplicate] = results.sort((a, b) => a.status - b.status);
    assert.equal(winner.status, 200);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.error.code, 'REFRESH_CONFLICT');
    assert.equal(duplicate.setCookie, null);
    assert.notEqual(winner.cookie, initial.cookie);
    const rotated = await Session.findById(id);
    assert.equal(rotated.generation, 1);
    assert.equal(+rotated.expiresAt, +original.expiresAt);
    assert.equal((await me(winner.data.accessToken)).status, 200);

    const alteredCookie = initial.cookie.replace(/\.[^.]+$/, '.' + 'A'.repeat(43));
    assert.equal((await refresh(alteredCookie)).status, 401);
    assert.equal((await me(winner.data.accessToken)).status, 200);

    await Session.updateOne({ _id: id }, { rotatedAt: new Date(Date.now() - refreshOverlap - 1000) });
    assert.equal((await refresh(initial.cookie)).status, 401);
    assert.equal((await refresh(winner.cookie)).status, 401);
    assert.equal((await me(winner.data.accessToken)).status, 401);
    assert.ok((await Session.findById(id)).revokedAt);

    const fresh = await login();
    const freshId = fresh.cookie.split('=')[1].split('.')[0];
    await Session.updateOne({ _id: freshId }, { expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await refresh(fresh.cookie)).status, 401);
    assert.equal((await me(fresh.data.accessToken)).status, 401);
  });

  await t.test('CSRF rejects cross-origin and missing-header writes without rotating the token', async () => {
    const session = await login();
    for (const headers of [{ Origin: 'https://unlisted.example' }, { 'X-LinkSnap-CSRF': '' }]) {
      const denied = await auth('refresh', { method: 'POST', cookie: session.cookie, headers });
      assert.equal(denied.status, 403);
      assert.equal(denied.error.code, 'CSRF_REJECTED');
    }
    assert.equal((await refresh(session.cookie)).status, 200);
  });

  await t.test('logout revokes the session, including when its cookie was just rotated', async () => {
    const original = await login();
    const rotated = await refresh(original.cookie);
    const result = await auth('logout', { method: 'POST', cookie: original.cookie });
    assert.equal(result.status, 200);
    assert.match(result.setCookie, /linksnap_refresh=;/);
    assert.equal((await refresh(rotated.cookie)).status, 401);
    assert.equal((await me(rotated.data.accessToken)).status, 401);
  });

  await t.test('logout-all revokes active sessions and bearer tokens', async () => {
    const first = await login();
    const second = await login();
    const result = await auth('logout-all', { method: 'POST', token: first.data.accessToken });
    assert.equal(result.status, 200);
    for (const session of [first, second]) {
      assert.equal((await refresh(session.cookie)).status, 401);
      assert.equal((await me(session.data.accessToken)).status, 401);
    }
  });

  await t.test('change password checks current password, replaces hash, and revokes sessions', async () => {
    const first = await login();
    const second = await login();
    const change = (currentPassword) => auth('change-password', {
      method: 'PATCH', token: first.data.accessToken, body: { currentPassword, newPassword },
    });
    assert.equal((await change('incorrect password')).error.code, 'INVALID_CURRENT_PASSWORD');
    assert.equal((await me(first.data.accessToken)).status, 200);
    assert.equal((await change(password)).status, 200);
    assert.equal((await me(second.data.accessToken)).status, 401);
    assert.equal((await refresh(second.cookie)).status, 401);
    assert.equal((await login()).status, 401);
    assert.equal((await login({ email, password: newPassword })).status, 200);
  });

  await t.test('production cookies use Secure, HttpOnly, host scope and an explicit credentialed origin', async () => {
    const secureConfig = readConfig({
      NODE_ENV: 'production', AUTH_SECRET: secret, MONGODB_URI: mongoUri, CLIENT_ORIGINS: secureOrigin,
    });
    const productionRequest = requestFrom(await listen(t, createApp(secureConfig)), secureOrigin);
    const result = await productionRequest('/api/v1/auth/login', { method: 'POST', body: { email, password: newPassword } });
    assert.equal(result.status, 200);
    assert.match(result.setCookie, /^__Host-linksnap_refresh=/);
    assert.match(result.setCookie, /; Secure/);
    assert.match(result.setCookie, /; HttpOnly/);
    assert.match(result.setCookie, /; SameSite=Lax/);
    assert.match(result.setCookie, /; Path=\/;/);
    assert.doesNotMatch(result.setCookie, /; Domain=/);
    assert.equal(result.headers.get('access-control-allow-origin'), secureOrigin);
    assert.equal(result.headers.get('access-control-allow-credentials'), 'true');
  });
});
