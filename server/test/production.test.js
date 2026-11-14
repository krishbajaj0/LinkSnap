import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';

test('production routes prioritize API, redirects and built assets over SPA fallback', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'linksnap-frontend-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'assets', 'app-abcd.js'), 'export {};');
  await writeFile(join(directory, 'index.html'), '<!doctype html><div id="root"></div>');
  await writeFile(join(directory, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  let databaseReady = true;
  const server = createApp({ environment: 'production', clientOrigins: new Set(['https://linksnap.example']) }, {
    frontendDirectory: directory, checkDatabase: () => databaseReady,
  }).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const path of ['/', '/login', '/register', '/report/Example1', '/preview/Example1',
    '/dashboard', '/dashboard/links', '/dashboard/links/123/qr', '/dashboard/analytics/links/123',
    '/dashboard/analytics', '/dashboard/settings', '/dashboard/moderation']) {
    const response = await fetch(base + path + '?check=1');
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /id="root"/);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    const csp = response.headers.get('content-security-policy');
    assert.match(csp, /script-src 'self';/);
    assert.match(csp, /img-src 'self' data: blob:/);
  }

  const js = await fetch(base + '/assets/app-abcd.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.match(js.headers.get('cache-control'), /immutable/);
  assert.equal(await js.text(), 'export {};');
  assert.equal((await fetch(base + '/favicon.svg')).status, 200);

  for (const [path, code] of [['/api/v1/missing?check=1', 'NOT_FOUND'],
    ['/assets/missing.js', 'NOT_FOUND'], ['/assets', 'NOT_FOUND'], ['/Example1?check=1', 'SHORT_LINK_UNAVAILABLE']]) {
    const response = await fetch(base + path, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 404, path);
    assert.equal((await response.json()).error.code, code);
  }

  const missingPage = await fetch(base + '/dashboard/no/such/page', { headers: { Accept: 'text/html' } });
  assert.equal(missingPage.status, 404);
  assert.match(await missingPage.text(), /id="root"/);
  assert.equal((await fetch(base + '/api/v1/health/ready')).status, 200);
  databaseReady = false;
  assert.equal((await fetch(base + '/api/v1/health/ready')).status, 503);
  const denied = await fetch(base + '/api/v1/health', { headers: { Origin: 'https://unlisted.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  assert.equal(denied.status, 200);
  assert.equal(denied.headers.get('ratelimit'), null);
  assert.equal((await fetch(base + '/api/v1/health/ready')).headers.has('ratelimit'), true);
});

test('Render defaults to its actual HTTPS origin, with an explicit override for custom domains', () => {
  const environment = {
    NODE_ENV: 'production', PORT: '10000', RENDER: 'true',
    RENDER_EXTERNAL_URL: 'https://linksnap-example.onrender.com',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/linksnap_test', AUTH_SECRET: 'a'.repeat(64),
  };
  const config = readConfig(environment);
  assert.equal(config.port, 10000);
  assert.equal(config.host, '0.0.0.0');
  assert.deepEqual([...config.clientOrigins], [environment.RENDER_EXTERNAL_URL]);
  assert.deepEqual(config.trustedProxyIps, []);
  assert.deepEqual([...readConfig({ ...environment, CLIENT_ORIGINS: 'https://short.example.com' }).clientOrigins],
    ['https://short.example.com']);
  assert.throws(() => readConfig({ ...environment, CLIENT_ORIGINS: 'http://short.example.com' }), /HTTPS origins/);
});
