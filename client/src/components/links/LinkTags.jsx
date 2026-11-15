import { useState } from 'react';
import { CardHeading } from '../dashboard/WorkspaceUi.jsx';

export default function LinkTags({ tags, pending, onSave }) {
  const [value, setValue] = useState('');

  async function add(event) {
    event.preventDefault();
    const tag = value.trim().toLowerCase().replace(/ +/g, ' ');
    if (tags.includes(tag)) {
      setValue('');
      return;
    }
    if (await onSave([...tags, tag])) setValue('');
  }

  return (
    <section className="dashboard-panel workspace-card" aria-labelledby="link-tags-title">
      <CardHeading id="link-tags-title" title="Tags" icon="settings" />
      {tags.length === 0 && <p>No tags yet.</p>}
      <ul className="tag-list">
        {tags.map((tag) => (
          <li key={tag}><button className="tag-pill" type="button" disabled={pending}
            aria-label={`Remove tag ${tag}`} onClick={() => void onSave(tags.filter((item) => item !== tag))}>{tag} ×</button></li>
        ))}
      </ul>
      <form onSubmit={add} className="link-tag-form">
        <label>New tag<input required maxLength={32} value={value} onChange={(event) => setValue(event.target.value)} disabled={pending || tags.length >= 10} /></label>
        <button className="primary-btn" type="submit" disabled={pending || tags.length >= 10}>Add tag</button>
      </form>
      <p>Up to 10 tags. Use letters, digits, spaces or hyphens.</p>
    </section>
  );
}
