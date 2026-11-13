import { useEffect, useRef, useState } from 'react';

export default function BulkActions({ count, pending, onClear, onApply }) {
  const [action, setAction] = useState('disable');
  const [tag, setTag] = useState('');
  const dialog = useRef(null);
  const trigger = useRef(null);
  const usesTag = action === 'add-tag' || action === 'remove-tag';

  useEffect(() => {
    const modal = dialog.current;
    return () => { if (modal?.open) modal.close(); };
  }, []);

  function submit(event) {
    event.preventDefault();
    if (action === 'delete') dialog.current.showModal();
    else void onApply(action, usesTag ? tag : undefined);
  }

  return (
    <div className="bulk-actions">
      <form onSubmit={submit} aria-label="Bulk actions">
        <fieldset disabled={pending}>
          <strong>{count} selected</strong>
          <label>Bulk action<select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="disable">Disable</option><option value="enable">Enable</option><option value="delete">Delete</option>
            <option value="add-tag">Add tag</option><option value="remove-tag">Remove tag</option>
          </select></label>
          {usesTag && <label>Bulk tag<input required maxLength={32} value={tag} onChange={(event) => setTag(event.target.value)} /></label>}
          <button className="primary-btn" type="submit" ref={trigger}>{pending ? 'Applying…' : 'Apply action'}</button>
          <button className="secondary-btn" type="button" onClick={onClear}>Clear selection</button>
        </fieldset>
      </form>
      <dialog ref={dialog} className="delete-dialog" aria-labelledby="bulk-delete-title" aria-describedby="bulk-delete-description"
        onClose={() => trigger.current?.focus()}>
        <h2 id="bulk-delete-title">Delete {count} selected {count === 1 ? 'link' : 'links'}?</h2>
        <p id="bulk-delete-description">Deleted links stop redirecting and their aliases stay reserved.</p>
        <div className="link-actions">
          <button className="secondary-btn" type="button" autoFocus onClick={() => dialog.current.close()}>Cancel</button>
          <button className="primary-btn link-delete" type="button" onClick={() => {
            dialog.current.close();
            void onApply('delete');
          }}>Confirm bulk deletion</button>
        </div>
      </dialog>
    </div>
  );
}
