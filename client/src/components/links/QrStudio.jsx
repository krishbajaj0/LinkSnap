import { useMemo, useState } from 'react';
import { defaults, downloadQr, makeQrSvg, pngBlob, readLogo, sizes, svgBlob } from '../../services/qr.js';
import { buildQrUrl } from '../../services/qrUrl.js';
import ShortLink from './ShortLink.jsx';

function ColorControl({ label, value, onChange }) {
  const pickerValue = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <div className="qr-color">
      <label>{label} color
        <input type="color" value={pickerValue} onInput={(event) => onChange(event.currentTarget.value)}
          onChange={(event) => onChange(event.currentTarget.value)} />
      </label>
      <label>{label} hex
        <input type="text" value={value} maxLength={7} spellCheck={false} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}

export default function QrStudio({ link }) {
  const [settings, setSettings] = useState(defaults);
  const [logo, setLogo] = useState(null);
  const [reading, setReading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = reading || Boolean(exporting);

  const target = useMemo(() => {
    try {
      return { url: buildQrUrl(link.shortPath, {
        configuredOrigin: import.meta.env.VITE_PUBLIC_BASE_URL,
        development: import.meta.env.DEV,
        currentOrigin: window.location.origin,
      }) };
    } catch (failure) {
      return { error: failure.message };
    }
  }, [link.shortPath]);

  const preview = useMemo(() => {
    if (!target.url) return {};
    try {
      const svg = makeQrSvg(target.url, settings, logo);
      return { svg, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
    } catch (failure) {
      return { error: failure.message };
    }
  }, [target.url, settings, logo]);

  function change(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    setNotice('');
    setError('');
  }

  async function upload(event) {
    const file = event.currentTarget.files[0];
    event.currentTarget.value = '';
    if (!file) return;
    setReading(true);
    setError('');
    setNotice('');
    try {
      setLogo(await readLogo(file));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setReading(false);
    }
  }

  function reset() {
    setSettings(defaults);
    setLogo(null);
    setError('');
    setNotice('Default settings restored.');
  }

  async function exportFile(format) {
    if (!preview.svg || busy) return;
    setExporting(format);
    setError('');
    setNotice('');
    try {
      const blob = format === 'png' ? await pngBlob(preview.svg, settings.size) : svgBlob(preview.svg);
      downloadQr(blob, `linksnap-${link.shortCode}.${format}`);
      setNotice(`${format.toUpperCase()} download started.`);
    } catch {
      setError('Could not export the QR image. Try again.');
    } finally {
      setExporting('');
    }
  }

  if (target.error) return <p className="form-error" role="alert">{target.error}</p>;

  return (
    <>
      <section className="dashboard-panel qr-url">
        <h2>Encoded short URL</h2>
        <ShortLink path={link.shortPath} url={target.url} />
        {import.meta.env.DEV && !import.meta.env.VITE_PUBLIC_BASE_URL?.trim() && (
          <p>This QR code is for local testing and uses this computer’s loopback address.</p>
        )}
        {link.status !== 'active' && <p>This link is {link.status} and currently does not redirect.</p>}
        <p>Scan with a camera to open the short URL. A QR code does not verify destination safety.</p>
      </section>
      <div className="qr-grid">
        <section className="dashboard-panel qr-settings">
          <h2>Customize</h2>
          <fieldset disabled={busy}>
            <ColorControl label="Foreground" value={settings.foreground} onChange={(value) => change('foreground', value)} />
            <ColorControl label="Background" value={settings.background} onChange={(value) => change('background', value)} />
            <label>Size <select value={settings.size} onChange={(event) => change('size', Number(event.target.value))}>
              {sizes.map((size) => <option key={size} value={size}>{size} × {size} px</option>)}
            </select></label>
            <label>Center logo <input type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="logo-hint" onChange={upload} /></label>
            <p id="logo-hint">PNG, JPEG or WebP. Up to 2 MB and 2048 × 2048 px. Kept in this browser.</p>
            <div className="link-actions">
              {logo && <button type="button" className="secondary-btn" onClick={() => {
                setLogo(null);
                setError('');
                setNotice('Logo removed.');
              }}>Remove logo</button>}
              <button type="button" className="secondary-btn" onClick={reset}>Reset to defaults</button>
            </div>
          </fieldset>
        </section>
        <section className="dashboard-panel qr-preview" aria-busy={busy}>
          <h2>Live preview</h2>
          {preview.src && <img className="qr-image" src={preview.src} width={settings.size} height={settings.size}
            alt={`QR code for ${target.url}`} />}
          {preview.error && <p className="form-error" role="alert">{preview.error}</p>}
          <div className="link-actions">
            <button type="button" className="primary-btn" disabled={!preview.svg || busy} onClick={() => void exportFile('png')}>Download PNG</button>
            <button type="button" className="primary-btn" disabled={!preview.svg || busy} onClick={() => void exportFile('svg')}>Download SVG</button>
          </div>
          <p className={notice ? 'form-success' : undefined} role="status">{reading ? 'Reading logo…' : exporting ? `Preparing ${exporting.toUpperCase()}…` : notice}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
        </section>
      </div>
    </>
  );
}
