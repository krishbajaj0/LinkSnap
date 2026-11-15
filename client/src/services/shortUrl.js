import { buildQrUrl } from './qrUrl.js';

export function publicShortUrl(path) {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_BASE_URL;
  if (configuredOrigin) {
    try {
      return buildQrUrl(path, { configuredOrigin });
    } catch {
      // A malformed local build setting does not stop link management.
    }
  }
  return new URL(path, window.location.origin).href;
}
