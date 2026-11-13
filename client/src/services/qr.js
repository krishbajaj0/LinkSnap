import QRCode from 'qrcode';

export const sizes = [256, 384, 512, 768, 1024, 1536, 2048];
export const defaults = Object.freeze({ foreground: '#000000', background: '#FFFFFF', size: 512 });
export const quietZone = 4;
export const logoMaxBytes = 2 * 1024 * 1024;
const colorPattern = /^#[0-9a-f]{6}$/i;

function luminance(color) {
  return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
}

export function validateQrSettings({ foreground, background, size }) {
  if (!sizes.includes(size)) throw new Error('Choose a QR size from 256 to 2048 pixels.');
  if (!colorPattern.test(foreground) || !colorPattern.test(background)) throw new Error('Choose valid solid colors.');
  if ((luminance(background) + 0.05) / (luminance(foreground) + 0.05) < 4.5) {
    throw new Error('Low contrast. Choose a darker foreground and a lighter background for reliable scanning.');
  }
}

export function makeQrSvg(url, settings, logo = null) {
  validateQrSettings(settings);
  const { foreground, background, size } = settings;
  const { modules } = QRCode.create(url, { errorCorrectionLevel: logo ? 'H' : 'M' });
  const extent = modules.size + 2 * quietZone;
  if (size < extent * 4) throw new Error('This URL needs a larger QR size. Choose the next size.');
  if (logo && (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(logo) || modules.size > 41)) {
    throw new Error('This QR code cannot safely fit a center logo. Remove the logo to continue.');
  }
  const paths = [];
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size;) {
      if (!modules.get(row, column)) {
        column++;
        continue;
      }
      const start = column;
      while (column < modules.size && modules.get(row, column)) column++;
      const run = column - start;
      paths.push(`M${start + quietZone},${row + quietZone}h${run}v1h-${run}z`);
    }
  }
  let overlay = '';
  if (logo) {
    // An odd patch aligns to modules, including its one-module backing border.
    const patch = Math.max(3, Math.min(7, Math.floor(modules.size * 0.085) * 2 + 1));
    const start = (extent - patch) / 2;
    overlay = `<rect x="${start}" y="${start}" width="${patch}" height="${patch}" fill="${background}"/><image x="${start + 1}" y="${start + 1}" width="${patch - 2}" height="${patch - 2}" href="${logo}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${extent} ${extent}"><rect width="${extent}" height="${extent}" fill="${background}"/><path fill="${foreground}" shape-rendering="crispEdges" d="${paths.join('')}"/>${overlay}</svg>`;
}

export function validateLogoHeader(type, size, bytes) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (!size || size > logoMaxBytes) throw new Error('Choose a logo no larger than 2 MB.');
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(type === 'image/png' ? png : type === 'image/jpeg' ? jpeg : webp)) {
    throw new Error('The logo file does not match its image type.');
  }
}

export function validateLogoDimensions(width, height) {
  if (!width || !height || width > 2048 || height > 2048) throw new Error('Logo dimensions must be within 2048 × 2048 pixels.');
}

function canvas(size) {
  const result = document.createElement('canvas');
  result.width = result.height = size;
  return result;
}

export async function readLogo(file) {
  validateLogoHeader(file.type, file.size, new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This logo could not be decoded. Try another image.');
  }
  try {
    validateLogoDimensions(bitmap.width, bitmap.height);
    const output = canvas(128);
    const scale = 128 / Math.max(bitmap.width, bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    output.getContext('2d').drawImage(bitmap, (128 - width) / 2, (128 - height) / 2, width, height);
    return output.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

export function svgBlob(svg) {
  return new Blob([svg], { type: 'image/svg+xml' });
}

export async function pngBlob(svg, size) {
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const output = canvas(size);
    output.getContext('2d').drawImage(image, 0, 0, size, size);
    return await new Promise((resolve, reject) => output.toBlob((blob) =>
      blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadQr(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
