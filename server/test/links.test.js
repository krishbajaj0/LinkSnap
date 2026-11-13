import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User, Session } from '../src/auth/models.js';
import { readConfig } from '../src/config/env.js';
import { Link } from '../src/links/model.js';
import { generateShortCode } from '../src/links/service.js';
import { isShortCode, shortLinkProxyPattern } from '../src/links/paths.js';

test('short links with real auth and an isolated MongoDB database', async (t) => {
  const port = process.env.LINKSNAP_TEST_MONGO_PORT ?? '27017';
  assert.match(port, /^\d{1,5}$/);
  const db = 'linksnap_links_test_' + randomUUID().replaceAll('-', '');
  const mongoUri = 'mongodb://127.0.0.1:' + port + '/' + db;
  const config = readConfig({
    NODE_ENV: 'test', AUTH_SECRET: randomBytes(32).toString('hex'), MONGODB_URI: mongoUri,
  });
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  const candidates = [];
  const server = createApp(config, { generateCode: () => candidates.shift() ?? generateShortCode() }).listen(0, '127.0.0.1');
  t.after(async () => {
    try {
      await new Promise((resolve) => server.close(resolve));
      assert.equal(mongoose.connection.name, db);
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });
  await once(server, 'listening');
  await Promise.all([User.init(), Session.init(), Link.init()]);

  const base = 'http://127.0.0.1:' + server.address().port;
  const links = '/api/v1/links';
  const destination = 'https://example.test/Path%2Finner?q=Hello%20World&b=%2B#Section';
  let owner;
  let stranger;
  let primary;

  async function request(path, { method = 'GET', body, token } = {}) {
    const response = await fetch(base + path, {
      method, redirect: 'manual',
      headers: {
        Origin: 'http://localhost:5173', 'X-LinkSnap-CSRF': '1',
        ...(token && { Authorization: 'Bearer ' + token }),
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
    return {
      status: response.status, headers: response.headers,
      body: response.status === 302 ? await response.text() : await response.json(),
    };
  }

  const create = (body, token = owner) => request(links, { method: 'POST', body, token });
  const edit = (id, body, token = owner) => request(links + '/' + id, { method: 'PATCH', body, token });
  const remove = (id, token = owner) => request(links + '/' + id, { method: 'DELETE', token });
  const details = (id, token = owner) => request(links + '/' + id, { token });

  await t.test('authentication, automatic generation, uniqueness, and no expiration by default', async () => {
    assert.equal((await request(links, { method: 'POST', body: { destination } })).status, 401);
    for (const name of ['owner', 'stranger']) {
      const result = await request('/api/v1/auth/register', {
        method: 'POST', body: { name, email: name + '@example.test', password: 'Test password phrase 123' },
      });
      assert.equal(result.status, 201);
      if (name === 'owner') owner = result.body.data.accessToken;
      else stranger = result.body.data.accessToken;
    }

    const first = await create({ destination });
    const second = await create({ destination });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    primary = first.body.data;
    assert.match(primary.shortCode, /^[A-Za-z0-9]{8}$/);
    assert.match(second.body.data.shortCode, /^[A-Za-z0-9]{8}$/);
    assert.notEqual(primary.shortCode, second.body.data.shortCode);
    assert.equal(primary.codeType, 'automatic');
    assert.equal(primary.expiresAt, null);
    assert.equal((await Link.findById(primary.id)).lifetimeClicks, 0);
  });

  await t.test('unique-index collision retries and controlled exhaustion', async () => {
    candidates.push(primary.shortCode, 'dashboard', 'RetryA01');
    const retried = await create({ destination });
    assert.equal(retried.status, 201);
    assert.equal(retried.body.data.shortCode, 'RetryA01');
    candidates.push(...Array(5).fill(primary.shortCode));
    const exhausted = await create({ destination });
    assert.equal(exhausted.status, 503);
    assert.equal(exhausted.body.error.code, 'CODE_GENERATION_FAILED');
  });

  await t.test('custom aliases, duplicates, invalid inputs, and reserved paths', async () => {
    const body = { destination, alias: 'custom-one' };
    const saved = await create(body);
    assert.equal(saved.status, 201);
    assert.equal(saved.body.data.codeType, 'custom');
    assert.equal((await create(body)).status, 409);
    for (const alias of ['DASHBOARD', 'dashboard', 'login', 'register', 'a_bcd', 'abc', 'valid\n', ' valid']) {
      assert.equal((await create({ destination, alias })).status, 400);
    }
    for (const invalid of [
      undefined, 'example.test', 'https:///example.test', 'https://example.test/x\r\ny',
      'https://user:pass@example.test', 'https://@example.test', 'https://example.test\\other',
      'javascript:alert(1)', 'data:text/plain,test', 'file:///tmp/test', 'ftp://example.test',
      'https://example.test/' + 'x'.repeat(2048),
    ]) {
      assert.equal((await create({ destination: invalid })).status, 400);
    }
    assert.equal((await create({ destination, expiresAt: '2020-01-01T00:00:00Z' })).status, 400);
  });

  await t.test('ownership filters, safe IDs, immutable fields, destination editing and pagination', async () => {
    assert.equal((await details(primary.id, stranger)).status, 404);
    assert.equal((await edit(primary.id, { destination }, stranger)).status, 404);
    assert.equal((await remove(primary.id, stranger)).status, 404);
    assert.equal((await details('invalid')).status, 400);
    for (const patch of [{ shortCode: 'different' }, { alias: 'different' }, { enabled: 'true' }, { securityBlocked: false }, { ownerId: primary.id }]) {
      assert.equal((await edit(primary.id, patch)).status, 400);
    }
    const updated = await edit(primary.id, { destination: 'HTTPS://EXAMPLE.TEST/updated?q=a%20b#c' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.destination, 'https://example.test/updated?q=a%20b#c');
    assert.equal(updated.body.data.shortCode, primary.shortCode);
    assert.equal((await details(primary.id)).body.data.destination, updated.body.data.destination);

    const first = await request(links + '?page=1&limit=2', { token: owner });
    const second = await request(links + '?page=2&limit=2', { token: owner });
    assert.equal(first.body.data.total, 4);
    assert.equal(first.body.data.links.length, 2);
    assert.equal(second.body.data.links.length, 2);
    assert.equal(new Set([...first.body.data.links, ...second.body.data.links].map((link) => link.id)).size, 4);
    assert.equal((await request(links, { token: stranger })).body.data.total, 0);
    assert.equal((await request(links + '?page=0&limit=51', { token: owner })).status, 400);
  });

  await t.test('redirect preserves destination and rejects all unavailable states', async () => {
    const alias = 'lifecycle-test';
    const soon = new Date(Date.now() + 60_000).toISOString();
    const later = new Date(Date.now() + 120_000).toISOString();
    const result = await create({ alias, destination, expiresAt: soon });
    assert.equal(result.status, 201);
    const { id } = result.body.data;
    const publicLink = () => request('/' + alias);

    const redirect = await publicLink();
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), destination);
    assert.equal(redirect.headers.get('cache-control'), 'no-store');
    assert.equal(redirect.headers.get('set-cookie'), null);
    assert.equal(redirect.body, '');

    await Link.updateOne({ _id: id }, { expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await details(id)).body.data.status, 'expired');
    const expired = await publicLink();
    assert.equal(expired.status, 404);
    assert.equal(expired.headers.get('location'), null);
    assert.equal((await edit(id, { expiresAt: later })).body.data.expiresAt, later);
    assert.equal((await publicLink()).status, 302);
    assert.equal((await edit(id, { expiresAt: null })).body.data.expiresAt, null);
    assert.equal((await edit(id, { enabled: false })).body.data.status, 'disabled');
    assert.deepEqual((await publicLink()).body, expired.body);
    assert.equal((await edit(id, { enabled: true })).body.data.status, 'active');
    assert.equal((await publicLink()).status, 302);

    await Link.updateOne({ _id: id }, { securityBlocked: true });
    assert.equal((await edit(id, { enabled: true, expiresAt: null })).body.data.status, 'security-blocked');
    assert.deepEqual((await publicLink()).body, expired.body);
    assert.equal((await remove(id)).status, 200);
    assert.equal((await details(id)).status, 404);
    assert.deepEqual((await publicLink()).body, expired.body);
    assert.deepEqual((await request('/unknown-code')).body, expired.body);
    assert.ok((await Link.findById(id)).deletedAt);
    assert.equal((await create({ alias, destination })).status, 409);
  });

  await t.test('API and SPA paths are not interpreted as short codes', async () => {
    const proxy = new RegExp(shortLinkProxyPattern);
    for (const path of ['/', '/api', '/api/v1/health', '/dashboard', '/dashboard/links', '/LOGIN', '/register?x=1', '/assets', '/favicon.svg', '/@vite/client']) {
      assert.equal(proxy.test(path), false, path);
    }
    for (const path of ['/custom-one', '/RetryA01?foo=bar', '/custom-one/']) assert.equal(proxy.test(path), true, path);
    assert.equal(isShortCode('dashboard'), false);
    assert.equal((await request('/dashboard')).body.error.code, 'NOT_FOUND');
    assert.equal((await request('/api/v1/health')).status, 200);
    assert.equal((await request('/api')).body.error.code, 'NOT_FOUND');
  });
});
