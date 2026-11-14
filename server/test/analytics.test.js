import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { collectClick } from '../src/analytics/metadata.js';
import { ClickEvent, dayMs } from '../src/analytics/model.js';
import { csvCell, readRange } from '../src/analytics/query.js';
import { createClickRecorder, persistClick } from '../src/analytics/record.js';
import { User, Session } from '../src/auth/models.js';
import { readConfig } from '../src/config/env.js';
import { Link } from '../src/links/model.js';

test('privacy metadata, dates, and CSV escaping', async () => {
  const ua = 'Mozilla/5.0 (Linux; Android 13; Phone) Chrome/121.0 Mobile Safari/537.36';
  const request = { ip: '::ffff:192.0.2.1', get: (key) => ({
    'User-Agent': ua, Referer: 'https://private.news.example.co.uk/account?token=sample#section',
  })[key] };
  const link = { _id: 'test-link', ownerId: 'first-owner' };
  const config = { visitorSecret: randomBytes(32), lookupCountry: () => 'GB' };
  const date = new Date('2026-04-18T10:00:00Z');
  const first = await collectClick(request, link, config, date);
  assert.deepEqual([first.device, first.browser, first.os, first.country, first.referrer, first.bot],
    ['Mobile', 'Chrome', 'Android', 'GB', 'example.co.uk', false]);
  assert.equal(first.visitorId.length, 64);
  assert.equal((await collectClick(request, link, config, new Date(+date + 1000))).visitorId, first.visitorId);
  assert.notEqual((await collectClick(request, link, config, new Date(+date + dayMs))).visitorId, first.visitorId);
  assert.notEqual((await collectClick(request, { ...link, ownerId: 'other' }, config, date)).visitorId, first.visitorId);
  assert.equal((await collectClick(request, link, { ...config, visitorSecret: null }, date)).visitorId, null);
  assert.equal((await collectClick({ get: request.get }, link, { ...config, clientIp: request.ip }, date)).visitorId, first.visitorId);
  assert.doesNotMatch(JSON.stringify(first), /192\.0\.2\.1|account|token=|Mozilla/);
  assert.throws(() => readRange({ from: '2026-04-10', interval: 'hour' }, date), /up to 7 days/);
  assert.throws(() => readRange({ from: '2026-02-30' }, date), /valid calendar/);
  assert.throws(() => readRange({ to: '2026-04-19' }, date), /within retention/);
  assert.throws(() => readConfig({ TRUSTED_PROXY_IPS: '0.0.0.0/0' }), /exact/);
  assert.equal(csvCell('=1+1'), "\"'=1+1\"");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
});

test('live redirects, authenticated reports and lifetime counters in isolated MongoDB', async (t) => {
  const port = process.env.LINKSNAP_TEST_MONGO_PORT ?? '27017';
  assert.match(port, /^\d{1,5}$/);
  const name = 'linksnap_analytics_test_' + randomUUID().replaceAll('-', '');
  const uri = 'mongodb://127.0.0.1:' + port + '/' + name;
  const config = readConfig({ NODE_ENV: 'test', MONGODB_URI: uri, AUTH_SECRET: randomBytes(32).toString('hex'),
    ANALYTICS_VISITOR_SECRET: randomBytes(32).toString('hex') });
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  let server;
  t.after(async () => {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      assert.equal(mongoose.connection.name, name);
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });
  await Promise.all([User.init(), Session.init(), Link.init(), ClickEvent.init()]);
  const ttl = (await ClickEvent.collection.indexes()).find((index) => index.key.timestamp === 1);
  assert.equal(ttl.expireAfterSeconds, 90 * 86_400);
  assert.ok((await Link.collection.indexes()).every((index) => index.expireAfterSeconds === undefined));

  let fail = false;
  let attempted = 0;
  const recordClick = createClickRecorder(config, (event) => {
    attempted++;
    if (fail) throw Error('Synthetic analytics write failure');
    return persistClick(event);
  });
  server = createApp(config, { recordClick }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const api = '/api/v1';
  const destination = 'https://example.test/dest?x=1#part';
  async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
    return fetch(base + path, { method, redirect: 'manual',
      headers: { Origin: 'http://localhost:5173', 'X-LinkSnap-CSRF': '1',
        ...(token && { Authorization: 'Bearer ' + token }), ...(body && { 'Content-Type': 'application/json' }), ...headers },
      body: body && JSON.stringify(body) });
  }
  async function data(response, status = 200) {
    assert.equal(response.status, status);
    return (await response.json()).data;
  }
  const register = async (who) => (await data(await request(api + '/auth/register', {
    method: 'POST', body: { name: who, email: who + '@example.test', password: 'Analytics test password 123' },
  }), 201)).accessToken;
  const owner = await register('owner');
  const other = await register('other');
  const create = async (alias, token = owner) => data(await request(api + '/links', {
    method: 'POST', token, body: { alias, destination },
  }), 201);
  const first = await create('primary-clicks');
  const second = await create('other-clicks', other);
  const third = await create('another-click');
  const analytics = api + '/analytics';
  const ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36';
  const hit = (path, headers = {}, method = 'GET') => request(path, {
    method, headers: { 'User-Agent': ua, Connection: 'close', ...headers },
  });
  async function until(predicate) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await predicate()) return;
      await wait(20);
    }
    assert.fail('Expected asynchronous analytics to settle.');
  }

  for (const response of await Promise.all([
    hit(first.shortPath, { Referer: 'https://private.example.com/path?q=private', 'X-Forwarded-For': '203.0.113.1' }),
    hit(first.shortPath, { 'X-Forwarded-For': '203.0.113.2' }),
    hit(first.shortPath, { 'User-Agent': 'ExampleBot/1.0' }),
    hit(second.shortPath), hit(third.shortPath),
  ])) {
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), destination);
    assert.equal(response.headers.get('set-cookie'), null);
    await response.text();
  }

  await until(async () => (await Link.findById(first.id)).lifetimeClicks === 3
    && (await Link.findById(second.id)).lifetimeClicks === 1 && (await Link.findById(third.id)).lifetimeClicks === 1);
  const stored = await ClickEvent.find({ linkId: first.id }).select('+visitorId').lean();
  assert.equal(stored.length, 3);
  assert.equal(new Set(stored.filter((row) => !row.bot).map((row) => row.visitorId)).size, 1);
  assert.ok(stored.every((row) => row.country === 'Unknown'));
  assert.ok(stored.some((row) => row.referrer === 'example.com'));
  assert.doesNotMatch(JSON.stringify(stored), /203\.0\.113|Mozilla|q=private/);
  await persistClick(stored[0]);
  assert.equal((await Link.findById(first.id)).lifetimeClicks, 3);

  const report = await data(await request(analytics, { token: owner }));
  assert.deepEqual(report.counts, { total: 4, bot: 1, human: 3 });
  assert.deepEqual(report.lifetime, { total: 4, bot: 1, human: 3 });
  assert.equal(report.visitors.approximate, 1);
  assert.equal(report.visitors.identifiedClicks, 3);
  assert.equal(report.topLinks[0].id, first.id);
  assert.equal(report.topLinks.length, 2);
  assert.equal(report.trends.length, 30);
  assert.equal(report.trends.at(-1).clicks, 4);
  assert.doesNotMatch(JSON.stringify(report), /visitorId/);
  assert.deepEqual(report.breakdowns.country, [{ label: 'Unknown', clicks: 4 }]);
  assert.equal((await request(analytics)).status, 401);
  assert.equal((await request(analytics + '/links/' + first.id, { token: other })).status, 404);
  assert.equal((await request(analytics + '/links/' + first.id + '/export.csv', { token: other })).status, 404);
  assert.equal((await request(analytics + '?traffic=wrong', { token: owner })).status, 400);
  const perLink = await data(await request(analytics + '/links/' + first.id + '?interval=hour&traffic=human', { token: owner }));
  assert.deepEqual(perLink.counts, { total: 2, bot: 0, human: 2 });
  assert.equal(perLink.trends.at(-1).clicks, 2);
  assert.equal(perLink.lifetime.total, 3);
  const bot = await data(await request(analytics + '?traffic=bot', { token: owner }));
  assert.equal(bot.counts.total, 1);
  assert.equal(bot.visitors.approximate, null);
  const csv = await request(analytics + '/export.csv', { token: owner });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /attachment/);
  const text = await csv.text();
  assert.equal(text.trim().split('\r\n').length, 5);
  assert.match(text, /example\.com/);
  assert.doesNotMatch(text, /other-clicks|visitorId|private|Mozilla/);

  const linkExport = await request(analytics + '/links/' + first.id + '/export.csv?traffic=human', { token: owner });
  assert.equal(linkExport.headers.get('x-analytics-export-truncated'), 'false');
  const exportedRows = (await linkExport.text()).trim().split('\r\n').slice(1);
  assert.equal(exportedRows.length, 2);
  assert.ok(exportedRows.every((row) => row.includes('"primary-clicks"') && row.endsWith('"false"')));

  await ClickEvent.updateMany({ linkId: first.id }, { $set: { timestamp: new Date(Date.now() - 91 * dayMs) } });
  const retained = await data(await request(analytics + '/links/' + first.id, { token: owner }));
  assert.equal(retained.counts.total, 0);
  assert.equal(retained.lifetime.total, 3);

  assert.equal((await hit(first.shortPath, {}, 'HEAD')).status, 302);
  assert.equal((await hit(first.shortPath, { 'Sec-Purpose': 'prefetch' })).status, 302);
  for (const state of [
    { enabled: false }, { enabled: true, expiresAt: new Date(0) },
    { expiresAt: null, securityBlocked: true }, { securityBlocked: false, deletedAt: new Date() },
  ]) {
    await Link.updateOne({ _id: first.id }, { $set: state });
    assert.equal((await hit(first.shortPath)).status, 404);
  }
  assert.equal(attempted, 5);
  fail = true;
  const fallback = await hit(second.shortPath);
  assert.equal(fallback.status, 302);
  assert.equal(fallback.headers.get('location'), destination);
  await until(() => attempted === 6);
  assert.equal((await Link.findById(second.id)).lifetimeClicks, 1);
});
