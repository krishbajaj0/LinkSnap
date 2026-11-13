import { useState } from 'react';

function localDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function LinkFields({ link, pending, onSave }) {
  const [destination, setDestination] = useState(link?.destination ?? '');
  const [alias, setAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState(localDate(link?.expiresAt));
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!/^https?:\/\//i.test(destination.trim())) {
      setError('Enter a URL starting with http:// or https://.');
      return;
    }
    const fields = { destination };
    if (!link && alias) fields.alias = alias;
    if (expiresAt !== localDate(link?.expiresAt)) {
      const date = expiresAt ? new Date(expiresAt) : null;
      if (date && (!Number.isFinite(+date) || +date <= Date.now())) {
        setError('Choose an expiration in the future, or leave it blank.');
        return;
      }
      fields.expiresAt = date?.toISOString() ?? null;
    }
    try {
      await onSave(fields);
    } catch (failure) {
      setError(failure.status ? failure.message : 'Could not save the link. Try again.');
    }
  }

  return (
    <form className="auth-panel" aria-busy={pending} onSubmit={submit}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <fieldset disabled={pending}>
        <label>
          Destination URL
          <input required type="url" maxLength={2048} placeholder="https://example.com/article" value={destination}
            onChange={(event) => setDestination(event.target.value)} />
        </label>
        {!link && (
          <div className="link-field">
            <label>
              Custom alias (optional)
              <input pattern="[a-z0-9\\-]{4,32}" maxLength={32} value={alias} aria-describedby="alias-hint"
                onChange={(event) => setAlias(event.target.value)} />
            </label>
            <small id="alias-hint">Use 4–32 lowercase letters, digits or hyphens.</small>
          </div>
        )}
        <label>
          Expiration (optional, local time)
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </label>
        {expiresAt && <button className="text-link link-text-button" type="button" onClick={() => setExpiresAt('')}>Clear expiration</button>}
        <button className="primary-btn" type="submit">{pending ? 'Saving…' : link ? 'Save changes' : 'Create link'}</button>
      </fieldset>
    </form>
  );
}
