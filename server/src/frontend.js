import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const defaultDirectory = fileURLToPath(new URL('../../client/dist/', import.meta.url));
const frontendRoutes = /^\/(?:login|register|report(?:\/[^/]+)?|preview\/[^/]+|dashboard(?:\/(?:settings|moderation|links(?:\/[^/]+(?:\/qr)?)?|analytics(?:\/links\/[^/]+)?))?)\/?$/i;

export async function verifyFrontend() {
  try {
    await access(join(defaultDirectory, 'index.html'));
  } catch {
    throw new Error('Production frontend is missing. Build the client before starting LinkSnap.');
  }
}

export function createFrontendRouter(directory = defaultDirectory) {
  const router = express.Router();
  const assets = express.static(join(directory, 'assets'), { index: false, immutable: true, maxAge: '1y', redirect: false });
  const publicFiles = express.static(directory, { index: false, redirect: false });
  const index = join(directory, 'index.html');

  router.use('/assets', assets);
  router.get(/^\/(?:favicon\.svg|icons\.svg)$/, publicFiles);
  router.get(/.*/, (request, response, next) => {
    const path = request.path;
    if (/^\/(?:assets(?:\/|$)|favicon\.svg$|icons\.svg$)/i.test(path)) return next();
    const known = path === '/' || frontendRoutes.test(path);
    // Keep a genuine HTTP 404 for React's Not Found view.
    if (!known && (path.includes('.') || !request.accepts('html'))) return next();
    response.set('Cache-Control', 'no-cache');
    return response.status(known ? 200 : 404).sendFile(index);
  });
  return router;
}
