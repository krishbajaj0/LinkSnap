import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config/env.js';

async function listenForTest(t, options) {
  const server = createApp(readConfig({}), options).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}/api/v1`;
}

test('environment validation keeps local defaults and requires MongoDB in production', () => {
  const config = readConfig({});
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3000);
  assert.ok(config.clientOrigins.has('http://localhost:5173'));
  assert.throws(() => readConfig({ NODE_ENV: 'production' }), /MONGODB_URI is required/);
  assert.throws(() => readConfig({ PORT: '65536' }), /PORT/);
  assert.throws(() => readConfig({ NODE_ENV: 'staging' }), /NODE_ENV/);
  assert.throws(() => readConfig({ MONGODB_URI: 'https://example.test' }), /MongoDB connection string/);
  assert.throws(() => readConfig({ CLIENT_ORIGINS: 'https://example.test/path' }), /CLIENT_ORIGINS/);
  assert.equal(readConfig({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/linksnap',
  }).clientOrigins.size, 0);
});

test('HTTP foundation handles health, CORS, and JSON errors', async (t) => {
  let databaseReady = false;
  const base = await listenForTest(t, {
    checkDatabase: async () => {
      if (databaseReady instanceof Error) throw databaseReady;
      return databaseReady;
    },
  });

  const health = await fetch(`${base}/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(health.headers.get('content-security-policy'));
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.deepEqual(await health.json(), { success: true, data: { status: 'ok' } });

  const deniedOrigin = await fetch(`${base}/health`, {
    headers: { Origin: 'https://unlisted.example' },
  });
  assert.equal(deniedOrigin.headers.get('access-control-allow-origin'), null);
  await deniedOrigin.text();

  const unavailable = await fetch(`${base}/health/ready`);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, 'DATABASE_UNAVAILABLE');

  databaseReady = true;
  const ready = await fetch(`${base}/health/ready`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { success: true, data: { status: 'ready' } });

  databaseReady = new Error('synthetic private error detail');
  const unexpected = await fetch(`${base}/health/ready`);
  assert.equal(unexpected.status, 500);
  assert.deepEqual(await unexpected.json(), {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });

  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });

  const headers = { 'Content-Type': 'application/json' };
  const malformed = await fetch(`${base}/missing`, { method: 'POST', headers, body: '{"' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_JSON');

  const oversized = await fetch(`${base}/missing`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: 'x'.repeat(33 * 1024) }),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('API rate limiter returns a safe 429 after 120 requests from the same IP', async (t) => {
  const base = await listenForTest(t);

  for (let count = 0; count < 120; count += 1) {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    await response.text();
  }

  const blocked = await fetch(`${base}/health`);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.ok(blocked.headers.has('ratelimit'));
  assert.equal(blocked.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await blocked.json(), {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again later.' },
  });
});

test('MongoDB startup failure keeps connection details out of process output', async () => {
  const startServer = promisify(execFile);
  const serverPath = fileURLToPath(new URL('../src/server.js', import.meta.url));
  const syntheticPassword = 'synthetic-test-only';

  await assert.rejects(
    startServer(process.execPath, [serverPath], {
      timeout: 12_000,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        MONGODB_URI: `mongodb://test-user:${syntheticPassword}@127.0.0.1:1/linksnap`,
      },
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /MongoDB connection failed/);
      assert.doesNotMatch(error.stdout + error.stderr, /test-user|synthetic-test-only|mongodb:\/\//);
      return true;
    },
  );
});
