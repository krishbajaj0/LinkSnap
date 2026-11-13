import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import maxmind from 'maxmind';
import { getDomain } from 'tldts';

const browsers = [
  [/edg(?:e|a|ios)?\//i, 'Edge'], [/opr\/|opera\//i, 'Opera'],
  [/firefox\/|fxios\//i, 'Firefox'], [/chrome\/|crios\//i, 'Chrome'],
  [/safari\//i, 'Safari'], [/msie|trident\//i, 'Internet Explorer'],
];

const systems = [
  [/iphone|ipad|ipod/i, 'iOS'], [/android/i, 'Android'], [/windows/i, 'Windows'],
  [/cros/i, 'ChromeOS'], [/macintosh|mac os x/i, 'macOS'], [/linux/i, 'Linux'],
];

export function createCountryLookup(path) {
  if (!path) return () => 'Unknown';
  // Load once and keep lookups local. A missing or corrupt file degrades to Unknown.
  const database = maxmind.open(path).catch(() => {
    console.warn('Analytics country database unavailable.');
    return null;
  });
  return async (ip) => {
    const country = (await database)?.get(ip)?.country?.iso_code;
    return /^[A-Z]{2}$/.test(country ?? '') ? country : 'Unknown';
  };
}

function referrerDomain(value) {
  if (!value) return 'Direct';
  if (value.length > 2048) return 'Unknown';
  const url = URL.parse(value);
  if (!url || !['http:', 'https:'].includes(url.protocol)) return 'Unknown';
  const domain = getDomain(url.hostname, { detectIp: true, validateHostname: true });
  return domain && domain.length <= 253 ? domain : 'Unknown';
}

function classify(agent) {
  const bot = /bot\b|crawler|spider|slurp|headlesschrome|facebookexternalhit|preview|curl\/|wget\/|python-requests|uptimerobot/i.test(agent);
  const browser = bot ? 'Bot' : (browsers.find(([pattern]) => pattern.test(agent))?.[1] ?? 'Unknown');
  const os = systems.find(([pattern]) => pattern.test(agent))?.[1] ?? 'Unknown';
  let device = 'Unknown';
  if (bot) device = 'Other';
  else if (/ipad|tablet|kindle|silk\/|android(?!.*mobile)/i.test(agent)) device = 'Tablet';
  else if (/mobile|iphone|ipod/i.test(agent)) device = 'Mobile';
  else if (/Windows|Macintosh|Linux|CrOS/i.test(agent)) device = 'Desktop';
  else if (agent) device = 'Other';
  return { device, browser, os, bot };
}

export async function collectClick(request, link, { visitorSecret, lookupCountry, clientIp = request.ip }, timestamp = new Date()) {
  const agent = (request.get('User-Agent') ?? '').slice(0, 512);
  const { device, browser, os, bot } = classify(agent);
  const ip = (clientIp ?? '').replace(/^::ffff:(?=\d+\.)/i, '');
  let country = 'Unknown';
  let visitorId = null;
  if (isIP(ip)) {
    try {
      country = await lookupCountry(ip);
    } catch {
      // Country lookup is optional and should not discard the event.
    }
    if (!bot && visitorSecret) {
      const day = timestamp.toISOString().slice(0, 10);
      const dailyKey = createHmac('sha256', visitorSecret).update(day).digest();
      visitorId = createHmac('sha256', dailyKey)
        .update(JSON.stringify([String(link.ownerId), ip, device, browser, os])).digest('hex');
    }
  }
  return { linkId: link._id, ownerId: link.ownerId, timestamp, device, browser, os,
    country, referrer: referrerDomain(request.get('Referer')), bot, visitorId };
}
