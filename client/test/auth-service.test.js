import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiRequest, authRequest, withSessionLock } from '../src/services/auth.js';

test('auth requests use the same-origin cookie jar and trusted write header', async (t) => {
  const result = { user: { name: 'Example User' }, accessToken: 'fixture' };
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, data: result }));
  assert.deepEqual(await authRequest('/refresh', { method: 'POST' }), result);
  const [path, options] = send.mock.calls[0].arguments;
  assert.equal(path, '/api/v1/auth/refresh');
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.headers['X-LinkSnap-CSRF'], '1');
  assert.equal(options.headers.Authorization, undefined);
});

test('protected reads pass the access token and expose structured API errors', async (t) => {
  const error = { code: 'FORBIDDEN', message: 'Access denied.' };
  const send = t.mock.method(globalThis, 'fetch', async () => Response.json({ success: false, error }, { status: 403 }));
  await assert.rejects(apiRequest('/admin/reports', { token: 'fixture' }), (failure) => {
    assert.equal(failure.status, 403);
    assert.equal(failure.code, error.code);
    assert.equal(failure.message, error.message);
    return true;
  });
  const [path, options] = send.mock.calls[0].arguments;
  assert.equal(path, '/api/v1/admin/reports');
  assert.equal(options.headers.Authorization, 'Bearer fixture');
  assert.equal(options.headers['X-LinkSnap-CSRF'], undefined);
});

test('CSV requests distinguish valid exports and JSON errors', async (t) => {
  const csv = 'timestamp_utc,short_code\r\n';
  const send = t.mock.method(globalThis, 'fetch', async () => new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'X-Analytics-Export-Truncated': 'true' },
  }));
  const result = await apiRequest('/analytics/export.csv', { csv: true, token: 'fixture' });
  assert.equal(await result.blob.text(), csv);
  assert.equal(result.truncated, true);
  assert.equal(send.mock.calls[0].arguments[1].headers.Accept, 'text/csv');
  send.mock.mockImplementation(async () => Response.json({
    success: false, error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' },
  }, { status: 401 }));
  await assert.rejects(apiRequest('/analytics/export.csv', { csv: true }), { status: 401, code: 'UNAUTHENTICATED' });
});

test('session fallback serializes work and continues after a rejected request', async () => {
  const steps = [];
  const gate = Promise.withResolvers();
  const started = Promise.withResolvers();
  const first = withSessionLock(async () => {
    steps.push('first started');
    started.resolve();
    await gate.promise;
    steps.push('first failed');
    throw new Error('Fixture request failed');
  });
  const second = withSessionLock(() => {
    steps.push('second started');
    return 'ready';
  });
  const rejected = assert.rejects(first, /Fixture request failed/);
  await started.promise;
  assert.deepEqual(steps, ['first started']);
  gate.resolve();
  await rejected;
  assert.equal(await second, 'ready');
  assert.deepEqual(steps, ['first started', 'first failed', 'second started']);
});
