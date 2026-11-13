const reserved = new Set([
  'api', 'assets', 'auth', 'dashboard', 'login', 'register', 'logout', 'settings', 'analytics',
  'links', 'admin', 'health', 'preview', 'report', 'reports', 'docs', 'help', 'about', 'privacy',
  'terms', 'account', 'verify', 'verify-email', 'reset-password', 'forgot-password',
]);

export const isReservedCode = (code) => reserved.has(code.toLowerCase());

export const automaticCodePattern = /^[A-Za-z0-9]{8}(?![\s\S])/;
export const customCodePattern = /^[a-z0-9-]{4,32}(?![\s\S])/;

// Vite accepts a regex string as a proxy key. Reserve application paths regardless of case.
const reservedPattern = [...reserved].map((word) => word.replace(/[a-z]/g, (letter) =>
  `[${letter}${letter.toUpperCase()}]`)).join('|');
export const shortLinkProxyPattern =
  `^/(?!(?:${reservedPattern})(?:/?(?:\\?|$)))(?:[A-Za-z0-9]{8}|[a-z0-9-]{4,32})/?(?:\\?|$)`;

export function isShortCode(code) {
  return !isReservedCode(code) && (automaticCodePattern.test(code) || customCodePattern.test(code));
}
