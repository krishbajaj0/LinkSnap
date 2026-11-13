import { isShortCode } from '../../../server/src/links/paths.js';

const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

export function buildQrUrl(path, { configuredOrigin = '', currentOrigin = '', development = false } = {}) {
  if (typeof path !== 'string' || !path.startsWith('/') || !isShortCode(path.slice(1))) {
    throw new Error('This link does not have a valid short code.');
  }
  const configured = configuredOrigin.trim();
  const raw = configured || (development ? currentOrigin : '');
  const url = URL.parse(raw);
  const host = url?.hostname ?? '';
  const publicHost = host.includes('.') && !host.endsWith('.') && /[a-z]/i.test(host.split('.').at(-1))
    && !/\.(localhost|local|internal|invalid|test|example|lan|home|onion)$/i.test(host);
  const validOrigin = url && !url.username && !url.password && !url.search && !url.hash
    && url.pathname === '/' && (raw === url.origin || raw === url.origin + '/');

  if (!validOrigin || !(configured ? url.protocol === 'https:' && publicHost
    : development && loopback.has(host) && ['http:', 'https:'].includes(url.protocol))) {
    throw new Error('Set VITE_PUBLIC_BASE_URL to the public HTTPS origin that serves your short links.');
  }

  return url.origin + path;
}
