import { useMemo, useState } from 'react';
import { defaults, downloadQr, makeQrSvg, pngBlob, readLogo, sizes, svgBlob } from '../../services/qr.js';
import { buildQrUrl } from '../../services/qrUrl.js';
import ShortLink from './ShortLink.jsx';
import Icon from '../dashboard/Icon.jsx';
import { CardHeading, StatusBadge } from '../dashboard/WorkspaceUi.jsx';

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
      setError({ message: failure.message, source: 'logo' });
    } finally {
      setReading(false);
    }
  }

  function reset() {
    setSettings(defaults);
    setLogo(null);
    setError('');
    setNotice({ message: 'Default settings restored.', source: 'settings' });
  }

  async function exportFile(format) {
    if (!preview.svg || busy) return;
    setExporting(format);
    setError('');
    setNotice('');
    try {
      const blob = format === 'png' ? await pngBlob(preview.svg, settings.size) : svgBlob(preview.svg);
      downloadQr(blob, `linksnap-${link.shortCode}.${format}`);
      setNotice({ message: `${format.toUpperCase()} download started.`, source: 'export' });
    } catch {
      setError({ message: 'Could not export the QR image. Try again.', source: 'export' });
    } finally {
      setExporting('');
    }
  }

  if (target.error) return <p className="form-error" role="alert">{target.error}</p>;

  return (
    <div className="qr-grid">
      <section className="dashboard-panel workspace-card qr-preview" aria-labelledby="qr-preview-title" aria-busy={busy}>
        <div className="qr-url-heading">
          <CardHeading id="qr-preview-title" icon="qr" title="Live preview" />
          <StatusBadge status={link.status} />
        </div>
        <div className="qr-canvas">
          {preview.src && <img className="qr-image" src={preview.src} width={settings.size} height={settings.size}
            alt={`QR code for ${target.url}`} />}
          {preview.error && <p className="form-error" role="alert">{preview.error}</p>}
        </div>
        <div className="qr-url">
          <p className="workspace-panel-caption">Encoded short URL</p>
          <ShortLink path={link.shortPath} url={target.url} />
          {import.meta.env.DEV && !import.meta.env.VITE_PUBLIC_BASE_URL?.trim() && (
            <p className="workspace-panel-caption">Local preview codes use this computer’s loopback address.</p>
          )}
          {link.status !== 'active' && <p>This link is {link.status} and currently does not redirect.</p>}
        </div>
      </section>
      <section className="dashboard-panel workspace-card qr-settings" aria-labelledby="qr-settings-title">
        <CardHeading id="qr-settings-title" icon="settings" title="Customize" />
        <fieldset disabled={busy}>
          <ColorControl label="Foreground" value={settings.foreground} onChange={(value) => change('foreground', value)} />
          <ColorControl label="Background" value={settings.background} onChange={(value) => change('background', value)} />
          <label>Export size <select value={settings.size} onChange={(event) => change('size', Number(event.target.value))}>
            {sizes.map((size) => <option key={size} value={size}>{size} × {size} px</option>)}
          </select></label>
          <label>Center logo <input type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="logo-hint" onChange={upload} /></label>
          <p id="logo-hint">PNG, JPEG or WebP. Up to 2 MB and 2048 × 2048 px. Kept in this browser.</p>
          {reading && <p role="status">Reading logo…</p>}
          {error?.source === 'logo' && <p className="form-error" role="alert">{error.message}</p>}
          <div className="link-actions">
            {logo && <button type="button" className="secondary-btn" onClick={() => {
              setLogo(null);
              setError('');
              setNotice({ message: 'Logo removed.', source: 'settings' });
            }}>Remove logo</button>}
            <button type="button" className="secondary-btn" onClick={reset}>Reset to defaults</button>
          </div>
        </fieldset>
        {notice?.source === 'settings' && <p className="form-success" role="status">{notice.message}</p>}
      </section>
      <section className="dashboard-panel workspace-card qr-export" aria-labelledby="qr-export-title">
        <CardHeading id="qr-export-title" icon="download" title="Download">
          {settings.size} × {settings.size} px. Test the code at the size you plan to share or print.
        </CardHeading>
        <div className="link-actions">
          <button type="button" className="primary-btn workspace-button" disabled={!preview.svg || busy} onClick={() => void exportFile('png')}>
            <Icon name="download" /> Download PNG
          </button>
          <button type="button" className="secondary-btn workspace-button" disabled={!preview.svg || busy} onClick={() => void exportFile('svg')}>
            Download SVG
          </button>
        </div>
        <p className={notice?.source === 'export' ? 'form-success' : undefined} role="status">
          {exporting ? `Preparing ${exporting.toUpperCase()}…` : notice?.source === 'export' && notice.message}
        </p>
        {error?.source === 'export' && <p className="form-error" role="alert">{error.message}</p>}
      </section>
    </div>
  );
}
