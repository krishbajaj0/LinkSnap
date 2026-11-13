export async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-LinkSnap-CSRF'] = '1';
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api/v1${path}`, {
    method, headers, signal, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error?.message ?? 'The API is unavailable. Try again.');
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return payload.data;
}

export function authRequest(path, options) {
  return apiRequest(`/auth${path}`, options);
}

let pending = Promise.resolve();

export function withSessionLock(task) {
  if (navigator.locks) return navigator.locks.request('linksnap-auth-session', task);
  const operation = pending.then(task);
  pending = operation.catch(() => {});
  return operation;
}
