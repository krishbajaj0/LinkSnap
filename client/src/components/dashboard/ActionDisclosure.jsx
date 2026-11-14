import { useRef } from 'react';

export default function ActionDisclosure({ className, label, trigger, children }) {
  const summary = useRef(null);

  function close(event, restoreFocus = false) {
    if (!event.currentTarget.open) return;
    event.currentTarget.open = false;
    if (restoreFocus) summary.current.focus();
  }

  return (
    <details className={`workspace-disclosure ${className ?? ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.preventDefault();
          event.stopPropagation();
          close(event, true);
        }
      }}>
      <summary aria-label={label} ref={summary}>{trigger}</summary>
      <div className="workspace-disclosure-panel" onClick={(event) => {
        // Close on same-tab navigation, including links to the current route.
        const link = event.target.closest('a[href]');
        if (!link || link.target || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        summary.current.focus();
        event.currentTarget.parentElement.open = false;
      }}>{children}</div>
    </details>
  );
}
