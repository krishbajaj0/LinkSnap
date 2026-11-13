import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import jsQR from 'jsqr';
import { defaults, makeQrSvg, quietZone, sizes, svgBlob, validateLogoDimensions, validateLogoHeader } from '../src/services/qr.js';
import { buildQrUrl } from '../src/services/qrUrl.js';

const url = 'https://go.linksnap.dev/AbC1DeF2';
const logo = 'data:image/png;base64,' + new Resvg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#283593"/><circle cx="24" cy="24" r="12" fill="white"/></svg>',
).render().asPng().toString('base64');

function render(svg) {
  const image = new Resvg(svg).render();
  const { width, height, pixels } = image;
  const decoded = jsQR(new Uint8ClampedArray(pixels), width, height, { inversionAttempts: 'dontInvert' });
  return { width, height, decoded, pixels };
}

test('public QR origin is explicit in production and preserves short-code casing', () => {
  assert.equal(buildQrUrl('/AbC1DeF2', { configuredOrigin: 'https://go.linksnap.dev/' }), url);
  assert.equal(buildQrUrl('/AbC1DeF2', { development: true, currentOrigin: 'http://127.0.0.1:5173' }),
    'http://127.0.0.1:5173/AbC1DeF2');
  for (const origin of ['', 'https://localhost:5173', 'https://127.0.0.1', 'http://go.linksnap.dev',
    'https://go.linksnap.dev/path', 'https://user@go.linksnap.dev', 'https://go.linksnap.dev?token=private', 'https://a.localhost.']) {
    assert.throws(() => buildQrUrl('/AbC1DeF2', { configuredOrigin: origin, currentOrigin: 'http://localhost:5173' }), /VITE_PUBLIC_BASE_URL/);
  }
  for (const path of ['/dashboard', '/api/v1/links', '//evil.example', '/code?token=x']) {
    assert.throws(() => buildQrUrl(path, { configuredOrigin: 'https://go.linksnap.dev' }), /valid short code/);
  }
  assert.throws(() => buildQrUrl('/AbC1DeF2', { development: true, currentOrigin: 'http://192.168.1.2:5173' }), /VITE_PUBLIC_BASE_URL/);
});

test('default SVG export decodes the exact URL at 512 pixels with four quiet modules', async () => {
  const svg = makeQrSvg(url, defaults);
  const blob = svgBlob(svg);
  assert.equal(blob.type, 'image/svg+xml');
  const image = render(await blob.text());
  assert.equal(image.width, 512);
  assert.equal(image.height, 512);
  assert.equal(image.decoded?.data, url);
  assert.match(svg, /fill="#000000"/);
  assert.match(svg, /fill="#FFFFFF"/);
  const extent = Number(svg.match(/viewBox="0 0 (\d+) /)[1]);
  const border = Math.floor(quietZone * image.width / extent);
  for (let row = 0; row < border; row++) {
    for (let column = 0; column < image.width; column++) {
      for (const [x, y] of [[column, row], [row, column], [column, image.height - 1 - row], [image.width - 1 - row, column]]) {
        const offset = (y * image.width + x) * 4;
        assert.equal(image.pixels.readUInt32BE(offset), 0xffffffff);
      }
    }
  }
});

test('custom SVG remains decodable with changed colors, dimensions and logo, and can reset', () => {
  const settings = { foreground: '#172554', background: '#EFF6FF', size: 768 };
  const customized = makeQrSvg(url, settings, logo);
  assert.match(customized, /fill="#172554"/);
  assert.match(customized, /fill="#EFF6FF"/);
  assert.match(customized, /<image /);
  const image = render(customized);
  assert.equal(image.width, 768);
  assert.equal(image.height, 768);
  assert.equal(image.decoded?.data, url);
  const removed = makeQrSvg(url, settings);
  assert.doesNotMatch(removed, /<image /);
  assert.equal(render(removed).decoded?.data, url);
  assert.equal(render(makeQrSvg(url, defaults)).width, 512);
  for (const size of sizes) assert.match(makeQrSvg(url, { ...defaults, size }), new RegExp('width="' + size + '" height="' + size + '"'));
  for (const size of [128, 257, 4096, '512']) assert.throws(() => makeQrSvg(url, { ...defaults, size }), /Choose a QR size/);
  assert.throws(() => makeQrSvg(url, { ...defaults, foreground: '#BBBBBB' }), /Low contrast/);
  assert.throws(() => makeQrSvg(url, { ...defaults, foreground: '#FFFFFF', background: '#000000' }), /Low contrast/);
  assert.throws(() => makeQrSvg(url, defaults, 'data:image/svg+xml,unsafe'), /cannot safely fit/);
});

test('logo limits reject unsupported types, oversized files, bad signatures and bad dimensions', () => {
  const header = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.doesNotThrow(() => validateLogoHeader('image/png', 500, header));
  assert.doesNotThrow(() => validateLogoHeader('image/jpeg', 500, new Uint8Array([255, 216, 255])));
  assert.throws(() => validateLogoHeader('image/svg+xml', 500, header), /PNG, JPEG or WebP/);
  assert.throws(() => validateLogoHeader('image/png', 3 * 1024 * 1024, header), /2 MB/);
  assert.throws(() => validateLogoHeader('image/jpeg', 500, header), /does not match/);
  assert.throws(() => validateLogoDimensions(2049, 128), /2048/);
  assert.doesNotThrow(() => validateLogoDimensions(2048, 2048));
});
