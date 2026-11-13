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

  await t.test('overview, searchable tags, date filters, sorting and safe bulk actions', async () => {
    const north = await create({ alias: 'north-2026', destination: 'https://example.test/campaign?place=north', tags: ['  Launch   Week ', 'launch week', 'Sales'] });
    const south = await create({ alias: 'south-2026', destination: 'https://example.test/campaign?place=south', tags: ['Sales'] });
    const foreign = await create({ alias: 'foreign-2026', destination, tags: ['Sales'] }, stranger);
    assert.equal(north.status, 201);
    assert.deepEqual(north.body.data.tags, ['launch week', 'sales']);
    const northId = north.body.data.id;
    const southId = south.body.data.id;
    const foreignId = foreign.body.data.id;
    await Link.updateOne({ _id: southId }, { expiresAt: new Date(Date.now() - 1000) });
    await edit(primary.id, { enabled: false });
    await Link.updateOne({ shortCode: 'RetryA01' }, { securityBlocked: true, enabled: false });
    const blockedId = String((await Link.findOne({ shortCode: 'RetryA01' }))._id);

    const overview = async () => (await request(links + '/overview', { token: owner })).body.data;
    const before = await overview();
    assert.deepEqual(before.counts, {
      total: 6, active: 3, disabled: 1, expired: 1, 'security-blocked': 1, recentlyCreated: 6, recentlyUpdated: 6,
    });
    assert.equal(before.newest.length, 5);
    assert.ok(before.newest.every((link) => link.id !== foreignId));
    assert.ok(before.updated.every((link) => link.id !== foreignId));
    assert.equal((await request(links + '/overview')).status, 401);

    const list = async (query) => (await request(links + '?' + query, { token: owner })).body.data;
    assert.deepEqual((await list('search=NORTH-2026')).links.map((link) => link.id), [northId]);
    assert.deepEqual((await list('search=place%3Dsouth')).links.map((link) => link.id), [southId]);
    assert.equal((await list('search=LAUNCH')).total, 1);
    assert.equal((await list('search=.*')).total, 0);
    assert.equal((await list('search=none')).hasLinks, true);
    assert.deepEqual((await list('status=expired')).links.map((link) => link.id), [southId]);
    assert.deepEqual((await list('status=disabled')).links.map((link) => link.id), [primary.id]);
    assert.equal((await list('status=active')).total, 3);
    assert.equal((await list('tag=SALES&sort=code')).total, 2);
    assert.deepEqual((await list('tag=sales&sort=code')).links.map((link) => link.id), [northId, southId]);
    assert.equal((await list('sort=oldest&limit=1')).links[0].id, primary.id);
    assert.equal((await list('sort=expiration')).links[0].id, southId);
    assert.equal((await list('page=1000&limit=50')).links.length, 0);
    assert.equal((await list('createdFrom=2000-01-01&createdTo=2000-01-01')).total, 0);
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await list('createdFrom=' + today + '&createdTo=' + today)).total, 6);
    for (const query of ['sort=constructor', 'status=deleted', 'createdTo=2026-02-30', 'page=1001', 'limit=51', 'search=a&search=b', 'foo=bar']) {
      assert.equal((await request(links + '?' + query, { token: owner })).status, 400, query);
    }
    assert.equal((await edit(northId, { tags: ['invalid!'] })).status, 400);

    const bulk = (action, ids, tag) => request(links + '/bulk', {
      method: 'POST', token: owner, body: { action, ids, ...(tag && { tag }) },
    });
    assert.equal((await request(links + '/bulk', { method: 'POST', body: { action: 'delete', ids: [northId] } })).status, 401);
    assert.equal((await bulk('delete', ['bad'])).status, 400);
    assert.equal((await bulk('delete', Array(51).fill(northId))).status, 400);
    const mixed = await bulk('disable', [northId, foreignId, northId]);
    assert.deepEqual(mixed.body.data, { requested: 2, changed: 1, skipped: 1 });
    assert.equal((await request('/north-2026')).status, 404);
    assert.equal((await request('/foreign-2026')).status, 302);
    assert.deepEqual((await bulk('enable', [northId, blockedId])).body.data, { requested: 2, changed: 1, skipped: 1 });
    assert.equal((await request('/north-2026')).status, 302);
    assert.equal((await request('/RetryA01')).status, 404);
    assert.deepEqual((await bulk('add-tag', [northId, southId], '  NEW Tag  ')).body.data, { requested: 2, changed: 2, skipped: 0 });
    assert.equal((await bulk('add-tag', [northId, southId], 'new tag')).body.data.changed, 0);
    assert.equal((await bulk('remove-tag', [northId, southId], 'SALES')).body.data.changed, 2);
    assert.deepEqual((await details(northId)).body.data.tags, ['launch week', 'new tag']);

    await edit(northId, { tags: Array.from({ length: 9 }, (_, index) => 'tag-' + index) });
    const concurrent = await Promise.all([bulk('add-tag', [northId], 'first'), bulk('add-tag', [northId], 'second')]);
    assert.equal(concurrent.reduce((sum, result) => sum + result.body.data.changed, 0), 1);
    assert.equal((await details(northId)).body.data.tags.length, 10);

    assert.deepEqual((await bulk('delete', [southId, foreignId])).body.data, { requested: 2, changed: 1, skipped: 1 });
    assert.equal((await details(southId)).status, 404);
    assert.equal((await create({ alias: 'south-2026', destination })).status, 409);
    assert.equal((await request('/foreign-2026')).status, 302);
    assert.equal((await overview()).counts.total, 5);
  });
});
