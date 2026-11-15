import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';

const origin = 'https://linksnap.example';
const renderEnv = {
  NODE_ENV: 'production', RENDER: 'true', RENDER_SERVICE_TYPE: 'web', RENDER_EXTERNAL_URL: origin,
  MONGODB_URI: 'mongodb://127.0.0.1/linksnap_test', AUTH_SECRET: 'a'.repeat(64),
};

async function listen(t, env) {
  const app = createApp(readConfig(env), { checkDatabase: () => true });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  return async (path, headers, method = 'GET') => {
    const response = await fetch(base + path, {
      headers: { Origin: origin, 'X-LinkSnap-CSRF': '1', ...headers }, method,
    });
    const body = await response.json();
    return { status: response.status, code: body.error?.code, rateLimit: response.headers.get('ratelimit') };
  };
}

test('Render edge trust is opt-in and cannot be combined with a proxy allowlist', () => {
  assert.equal(readConfig({}).trustRenderEdge, false);
  assert.equal(readConfig(renderEnv).trustRenderEdge, false);
  assert.equal(readConfig({ ...renderEnv, TRUST_RENDER_EDGE: 'true' }).trustRenderEdge, true);
  assert.throws(() => readConfig({ TRUST_RENDER_EDGE: '1' }), /must be true or false/);
  assert.throws(() => readConfig({ TRUST_RENDER_EDGE: 'true' }), /production Render web service/);
  assert.throws(() => readConfig({
    ...renderEnv, CLIENT_ORIGINS: origin, RENDER: 'false', TRUST_RENDER_EDGE: 'true',
  }), /production Render web service/);
  assert.throws(() => readConfig({
    ...renderEnv, RENDER_SERVICE_TYPE: 'pserv', TRUST_RENDER_EDGE: 'true',
  }), /production Render web service/);
  assert.throws(() => readConfig({
    ...renderEnv, TRUST_RENDER_EDGE: 'true', TRUSTED_PROXY_IPS: '127.0.0.1',
  }), /cannot be used together/);
  assert.deepEqual(readConfig({ TRUSTED_PROXY_IPS: '127.0.0.1' }).trustedProxyIps, ['127.0.0.1']);
});

test('Render requests use the edge IP for global, auth and report limits', async (t) => {
  const errors = t.mock.method(console, 'error', () => {});
  const request = await listen(t, { ...renderEnv, TRUST_RENDER_EDGE: 'true' });
  const edgeHeaders = (clientIp, forwardedIp) => ({
    'CF-Connecting-IP': clientIp,
    'X-Forwarded-For': `${forwardedIp}, ${clientIp}, 192.0.2.10`,
    Forwarded: `for=${forwardedIp}`,
    'X-Forwarded-Host': 'untrusted.example',
    'X-Forwarded-Proto': 'http',
  });
  const first = '198.51.100.10';
  const second = '198.51.100.11';

  for (let index = 0; index < 120; index += 1) {
    const outcome = await request('/health/ready', edgeHeaders(first, `203.0.113.${index}`));
    assert.equal(outcome.status, 200);
  }
  assert.equal((await request('/health/ready', edgeHeaders(first, second))).code, 'RATE_LIMIT_EXCEEDED');
  assert.match((await request('/health/ready', edgeHeaders(second, first))).rateLimit, /r=119\b/);
  assert.equal((await request('/health', edgeHeaders(first, second))).status, 200);

  for (const [path, limit, invalidStatus] of [['/auth/login', 12, 400], ['/reports', 5, 415]]) {
    for (let index = 0; index < limit; index += 1) {
      const outcome = await request(path, edgeHeaders('198.51.100.12', `203.0.113.${index}`), 'POST');
      assert.equal(outcome.status, invalidStatus);
    }
    assert.equal((await request(path, edgeHeaders('198.51.100.12', first), 'POST')).code, 'RATE_LIMIT_EXCEEDED');
    assert.equal((await request(path, edgeHeaders(second, first), 'POST')).status, invalidStatus);
  }
  assert.equal(errors.mock.callCount(), 0, 'Valid Render ingress must pass rate-limit validation');
});

test('missing or malformed Render edge IPs share the socket bucket and IPv6 subnet limits still apply', async (t) => {
  const errors = t.mock.method(console, 'error', () => {});
  const request = await listen(t, { ...renderEnv, TRUST_RENDER_EDGE: 'true' });
  const rateLimit = async (headers) => (await request('/health/ready', headers)).rateLimit;

  assert.match(await rateLimit({ 'X-Forwarded-For': '203.0.113.1', Forwarded: 'for=203.0.113.2' }), /r=119\b/);
  assert.match(await rateLimit({ 'CF-Connecting-IP': '203.0.113.3, 203.0.113.4' }), /r=118\b/);
  assert.match(await rateLimit({ 'CF-Connecting-IP': 'fe80::1%eth0' }), /r=117\b/);
  assert.match(await rateLimit({ 'CF-Connecting-IP': '2001:db8:10:1200::1' }), /r=119\b/);
  assert.match(await rateLimit({ 'CF-Connecting-IP': '2001:db8:10:12ff::2' }), /r=118\b/);
  assert.match(await rateLimit({ 'CF-Connecting-IP': '2001:db8:10:1300::1' }), /r=119\b/);
  assert.equal(errors.mock.callCount(), 0);
});

test('local direct requests use the socket IP even when forwarding headers are supplied', async (t) => {
  const errors = t.mock.method(console, 'error', () => {});
  const request = await listen(t, {});
  const first = await request('/health/ready', { 'X-Forwarded-For': '203.0.113.1', 'CF-Connecting-IP': '203.0.113.2' });
  const second = await request('/health/ready', { 'X-Forwarded-For': '203.0.113.3', 'CF-Connecting-IP': '203.0.113.4' });
  assert.match(first.rateLimit, /r=119\b/);
  assert.match(second.rateLimit, /r=118\b/);
  assert.equal(errors.mock.calls[0]?.arguments[0]?.code, 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR');
});
