import { isIP } from 'node:net';
import { readProhibitedDomains } from '../security/url-safety.js';

const developmentOrigins = 'http://localhost:5173,http://127.0.0.1:5173';

export function readConfig(env = process.env) {
  const environment = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environment)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const rawPort = env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const mongoUri = env.MONGODB_URI?.trim();
  if (environment === 'production' && !mongoUri) {
    throw new Error('MONGODB_URI is required in production.');
  }
  if (mongoUri && !/^mongodb(?:\+srv)?:\/\/[^\s/]/.test(mongoUri)) {
    throw new Error('MONGODB_URI must be a MongoDB connection string.');
  }

  const renderOrigin = env.RENDER === 'true' ? env.RENDER_EXTERNAL_URL : undefined;
  const defaultOrigins = environment === 'production' ? renderOrigin ?? '' : developmentOrigins;
  const clientOrigins = new Set(
    (env.CLIENT_ORIGINS ?? defaultOrigins).split(',').map((origin) => origin.trim()).filter(Boolean),
  );
  const protocols = environment === 'production' ? ['https:'] : ['http:', 'https:'];
  for (const origin of clientOrigins) {
    const url = URL.parse(origin);
    if (!url || !protocols.includes(url.protocol) || url.origin !== origin) {
      throw new Error(environment === 'production'
        ? 'CLIENT_ORIGINS must contain HTTPS origins without paths or trailing slashes.'
        : 'CLIENT_ORIGINS must contain HTTP(S) origins without paths or trailing slashes.');
    }
  }

  const host = env.HOST?.trim() || (environment === 'production' ? '0.0.0.0' : '127.0.0.1');
  const rawSecret = env.AUTH_SECRET?.trim();
  if (rawSecret && !/^[a-f0-9]{64}$/i.test(rawSecret)) {
    throw new Error('AUTH_SECRET must contain 32 random bytes encoded as 64 hex characters.');
  }
  if (environment === 'production' && (!rawSecret || !clientOrigins.size)) {
    throw new Error('AUTH_SECRET and CLIENT_ORIGINS are required in production.');
  }
  const authSecret = rawSecret ? Buffer.from(rawSecret, 'hex') : undefined;
  const rawVisitorSecret = env.ANALYTICS_VISITOR_SECRET?.trim();
  if (rawVisitorSecret && (!/^[a-f0-9]{64}$/i.test(rawVisitorSecret) || rawVisitorSecret.toLowerCase() === rawSecret?.toLowerCase())) {
    throw new Error('ANALYTICS_VISITOR_SECRET must be 32 random bytes in hex, distinct from AUTH_SECRET.');
  }
  const visitorSecret = rawVisitorSecret ? Buffer.from(rawVisitorSecret, 'hex') : undefined;
  const geoIpPath = env.ANALYTICS_GEOIP_PATH?.trim();
  const trustedProxyIps = (env.TRUSTED_PROXY_IPS ?? '').split(',').map((ip) => ip.trim()).filter(Boolean);
  if (trustedProxyIps.some((ip) => !isIP(ip) || ip.includes('%') || /^::ffff:/i.test(ip))) {
    throw new Error('TRUSTED_PROXY_IPS must contain exact IPv4 or IPv6 addresses.');
  }
  const renderEdge = env.TRUST_RENDER_EDGE ?? 'false';
  if (!['true', 'false'].includes(renderEdge)) {
    throw new Error('TRUST_RENDER_EDGE must be true or false.');
  }
  const trustRenderEdge = renderEdge === 'true';
  if (trustRenderEdge && (environment !== 'production' || env.RENDER !== 'true' || env.RENDER_SERVICE_TYPE !== 'web')) {
    throw new Error('TRUST_RENDER_EDGE requires a production Render web service.');
  }
  if (trustRenderEdge && trustedProxyIps.length) {
    throw new Error('TRUST_RENDER_EDGE and TRUSTED_PROXY_IPS cannot be used together.');
  }
  const prohibitedDomains = readProhibitedDomains(env.PROHIBITED_LINK_DOMAINS);
  return {
    environment, host, port, mongoUri, clientOrigins, authSecret, visitorSecret, geoIpPath,
    trustedProxyIps, trustRenderEdge, prohibitedDomains,
  };
}
