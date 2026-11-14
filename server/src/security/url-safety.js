import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import { parse } from 'tldts';
import { HttpError } from '../http/errors.js';
import { normalizeDestination } from '../links/validation.js';

const hostnameOf = (url) => url.hostname.replace(/\.$/, '');

export function readProhibitedDomains(value = '') {
  return new Set(value.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    const host = domainToASCII(item).toLowerCase().replace(/\.$/, '');
    if (host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)
        || /[\s/:?#@%\\]/.test(item)) {
      throw new Error('PROHIBITED_LINK_DOMAINS must contain comma-separated DNS domains.');
    }
    return host;
  }));
}

export function assessDestination(value, prohibited = new Set()) {
  const destination = normalizeDestination(value);
  const url = new URL(destination);
  const hostname = hostnameOf(url);
  const labels = hostname.split('.');
  const policyBlocked = labels.some((_, index) => prohibited.has(labels.slice(index).join('.')));
  const flags = [];
  if (policyBlocked) flags.push('prohibited-domain');
  if (isIP(hostname.replace(/^\[|\]$/g, ''))) flags.push('ip-literal');
  if (labels.some((label) => label.startsWith('xn--'))) flags.push('internationalized-host');
  const { subdomain } = parse(hostname, { allowPrivateDomains: true });
  const subdomains = subdomain?.split('.') ?? [];
  if (subdomains.length >= 3) flags.push('many-subdomains');
  if (subdomains.some((label) => /(?:^|-)(?:login|verify|secure|account|support|billing)(?:-|$)/.test(label))) {
    flags.push('misleading-subdomain');
  }
  if (/^\/(?:redirect|out|away|forward)(?:\/|$)/i.test(url.pathname)
      && [...url.searchParams].some(([key, target]) =>
        /^(?:url|to|target|next|redirect|return|destination)$/i.test(key) && /^(?:https?:\/\/|\/\/)/i.test(target.trim()))) {
    flags.push('possible-redirect-chain');
  }

  return { destination, hostname, protocol: url.protocol, flags,
    classification: policyBlocked ? 'blocked' : flags.length ? 'needs-review' : 'safe-looking' };
}

export function checkSubmission(value, prohibited) {
  const result = assessDestination(value, prohibited);
  if (result.classification === 'blocked') {
    throw new HttpError(400, 'DESTINATION_PROHIBITED', 'This destination is prohibited by LinkSnap policy.');
  }
  return { destination: result.destination, securityFlags: result.flags };
}
