import { useState } from 'react';

export default function ShortLink({ path, url = new URL(path, window.location.origin).href }) {
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
