import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User, Session } from '../src/auth/models.js';
import { readConfig } from '../src/config/env.js';
import { Link } from '../src/links/model.js';
import { Report } from '../src/moderation/model.js';
import { assessDestination, readProhibitedDomains } from '../src/security/url-safety.js';

test('destination assessment is local, explainable and strict about configured domains', () => {
  const prohibited = readProhibitedDomains(' blocked.example ');
  assert.equal(assessDestination('https://example.org/path', prohibited).classification, 'safe-looking');
  assert.equal(assessDestination('https://one.blocked.example./', prohibited).classification, 'blocked');
  assert.equal(assessDestination('https://notblocked.example/', prohibited).classification, 'safe-looking');
  assert.ok(assessDestination('http://127.0.0.1/').flags.includes('ip-literal'));
  assert.ok(assessDestination('https://bücher.example/').flags.includes('internationalized-host'));
  assert.ok(assessDestination('https://login.a.b.example.org/').flags.includes('many-subdomains'));
  assert.ok(assessDestination('https://login.a.b.example.org/').flags.includes('misleading-subdomain'));
  assert.ok(assessDestination('https://example.org/redirect?next=https%3A%2F%2Fexample.net').flags.includes('possible-redirect-chain'));
  for (const invalid of ['not a URL', 'javascript:alert(1)', 'https://user:pass@example.org']) {
    assert.throws(() => assessDestination(invalid), (error) => error.status === 400);
  }
  assert.throws(() => readProhibitedDomains('https://example.org/path'));
});

test('reports, previews and moderator decisions enforce redirect safety', async (t) => {
  const port = process.env.LINKSNAP_TEST_MONGO_PORT ?? '27017';
  assert.match(port, /^\d{1,5}$/);
  const db = 'linksnap_moderation_test_' + randomUUID().replaceAll('-', '');
  const uri = 'mongodb://127.0.0.1:' + port + '/' + db;
  const origin = 'http://localhost:5173';
  const config = readConfig({ NODE_ENV: 'test', MONGODB_URI: uri,
    AUTH_SECRET: randomBytes(32).toString('hex'), PROHIBITED_LINK_DOMAINS: 'blocked.example' });
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  let server;
  t.after(async () => {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      assert.equal(mongoose.connection.name, db);
      await mongoose.connection.dropDatabase();
    } finally { await mongoose.disconnect(); }
  });
  await Promise.all([User.init(), Session.init(), Link.init(), Report.init()]);
  const clicks = [];
  server = createApp(config, { recordClick: (_request, link) => clicks.push(String(link._id)) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const api = '/api/v1';

  async function request(path, { method = 'GET', body, token, csrf = '1' } = {}) {
    const response = await fetch(base + path, {
      method, redirect: 'manual',
      headers: { Origin: origin, 'X-LinkSnap-CSRF': csrf,
        ...(token && { Authorization: 'Bearer ' + token }), ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, data: response.status === 302
      ? await response.text() : await response.json() };
  }

  async function register(name) {
    const result = await request(api + '/auth/register', {
      method: 'POST', body: { name, email: name + '@example.test', password: 'Moderation test phrase 123', role: 'admin' },
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.data.user.role, 'user');
    return result.data.data;
  }

  const owner = await register('owner');
  const admin = await register('admin');
  await User.updateOne({ _id: admin.user.id }, { $set: { role: 'admin' } });
  const ownerToken = owner.accessToken;
  const adminToken = admin.accessToken;
  const create = (alias, destination) => request(api + '/links', { method: 'POST', token: ownerToken, body: { alias, destination } });
  const code = 'moderation-test';
  const created = await create(code, 'https://login.a.b.example.org/private?token=hidden#fragment');
  assert.equal(created.status, 201);
  assert.equal(created.data.data.needsReview, true);
  const id = created.data.data.id;
  const item = api + '/admin/links/' + id;
  const preview = api + '/preview/' + code;
  const edit = (body) => request(api + '/links/' + id, { method: 'PATCH', token: ownerToken, body });
  const decide = (action, reportId, csrf) => request(item, { method: 'PATCH', token: adminToken, csrf,
    body: { action, note: 'Checked address', ...(reportId && { reportId }) } });
  assert.equal((await create('policy-test', 'https://sub.blocked.example/')).data.error.code, 'DESTINATION_PROHIBITED');
  assert.equal((await edit({ destination: 'https://blocked.example/' })).status, 400);
  assert.deepEqual((await request(preview)).data.data, {
    hostname: 'login.a.b.example.org', protocol: 'https:', needsReview: true, continuePath: '/' + code,
  });
  assert.equal(clicks.length, 0);

  const reportPath = api + '/reports';
  const report = (body) => request(reportPath, { method: 'POST', body });
  assert.equal((await report({ shortCode: code, reason: 'bad' })).status, 400);
  const description = '<strong>Literal text</strong>';
  const accepted = await report({ shortCode: code, reason: 'phishing', description });
  assert.equal(accepted.status, 202);
  assert.deepEqual((await report({ shortCode: code, reason: 'phishing', description })).data, accepted.data);
  assert.deepEqual((await report({ shortCode: 'unknown-code', reason: 'phishing' })).data, accepted.data);
  assert.deepEqual((await report({ shortCode: code, reason: 'spam', website: 'trap' })).data, accepted.data);
  const limited = await report({ shortCode: code, reason: 'other' });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
  assert.equal(await Report.countDocuments(), 1);

  const queue = api + '/admin/reports';
  assert.equal((await request(queue)).status, 401);
  assert.equal((await request(queue, { token: ownerToken })).status, 403);
  assert.equal((await request(item, { method: 'PATCH', token: ownerToken, body: { action: 'block' } })).status, 403);
  assert.equal((await request(api + '/admin/links', { token: adminToken })).data.data.items[0].id, id);
  const pending = await request(queue, { token: adminToken });
  assert.equal(pending.status, 200);
  const reportId = pending.data.data.items[0]._id;
  assert.equal(pending.data.data.items[0].fingerprint, undefined);
  const reportDetails = await request(queue + '/' + reportId, { token: adminToken });
  assert.equal(reportDetails.data.data.report.description, description);
  assert.doesNotMatch(reportDetails.data.data.link.destination, /token=|#fragment/);
  const reportAction = (action) => request(queue + '/' + reportId, { method: 'PATCH', token: adminToken, body: { action } });
  assert.equal((await reportAction('review')).data.data.status, 'reviewed');
  assert.equal((await request(queue + '?status=reviewed', { token: adminToken })).data.data.total, 1);
  assert.equal((await reportAction('dismiss')).data.data.status, 'dismissed');
  assert.equal((await reportAction('review')).status, 409);

  assert.equal((await decide('block', reportId, 'wrong')).status, 403);
  assert.equal((await decide('block', reportId)).status, 200);
  assert.equal((await decide('block', reportId)).status, 409);
  assert.equal((await request(preview)).status, 404);
  assert.equal((await request('/' + code)).headers.get('location'), null);
  assert.equal((await edit({ enabled: true })).status, 409);
  assert.equal((await edit({ destination: 'https://example.org/new', expiresAt: null })).data.data.status, 'security-blocked');
  assert.equal((await request('/' + code)).status, 404);
  assert.equal(clicks.length, 0);
  assert.equal((await decide('unblock')).status, 200);
  assert.equal((await request('/' + code)).headers.get('location'), 'https://example.org/new');
  const updated = await request(item, { token: adminToken });
  assert.deepEqual(updated.data.data.history.map((entry) => entry.action), ['block', 'unblock']);
  assert.equal(updated.data.data.history[0].moderatorId, admin.user.id);
  assert.equal(updated.data.data.history[0].reportId, reportId);
  assert.equal((await request(queue + '/' + reportId, { token: adminToken })).data.data.report.moderationHistory.length, 2);

  for (const state of [
    { enabled: false }, { enabled: true, expiresAt: new Date(0) }, { expiresAt: null, deletedAt: new Date() },
  ]) {
    await Link.updateOne({ _id: id }, { $set: state });
    assert.equal((await request(preview)).status, 404);
    assert.equal((await request('/' + code)).status, 404);
  }
  await Link.updateOne({ _id: id }, { $set: { deletedAt: null, destination: 'https://blocked.example/' } });
  assert.equal((await request(preview)).status, 404);
  assert.equal((await request('/' + code)).status, 404);
  assert.equal(clicks.length, 1);
});
