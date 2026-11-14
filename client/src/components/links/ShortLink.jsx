import { useState } from 'react';
import { buildQrUrl } from '../../services/qrUrl.js';

function publicShortUrl(path) {
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

export default function ShortLink({ path, url = publicShortUrl(path) }) {
  const [message, setMessage] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Short URL copied.');
    } catch {
      setMessage('Clipboard unavailable. Select and copy the URL manually.');
    }
  }

  return (
    <div className="short-link">
      <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a>
      <button className="primary-btn" type="button" onClick={copy}>Copy short URL</button>
      <span role="status">{message}</span>
    </div>
  );
}
