import { Link } from 'react-router';
import ActionDisclosure from '../dashboard/ActionDisclosure.jsx';
import Icon from '../dashboard/Icon.jsx';
import { StatusBadge } from '../dashboard/WorkspaceUi.jsx';
import { publicShortUrl } from '../../services/shortUrl.js';

export default function LinksTable({ rows, selected, disabled, onSelect, onSelectAll, onCopy }) {
  const allSelected = selected.length === rows.length;
  return (
    <table className="workspace-links-table" aria-label="Your short links">
      <thead><tr>
        <th scope="col" className="link-select-cell"><label className="link-select-target">
          <input type="checkbox" aria-label="Select all links on this page" checked={allSelected} disabled={disabled}
            ref={(input) => { if (input) input.indeterminate = selected.length > 0 && !allSelected; }}
            onChange={(event) => onSelectAll(event.target.checked)} />
        </label></th>
        <th scope="col">Short link</th><th scope="col">Status</th><th scope="col">Created</th>
        <th scope="col"><span className="link-actions-heading">Actions</span></th>
      </tr></thead>
      <tbody>{rows.map((link) => (
        <tr key={link.id} data-selected={selected.includes(link.id) || undefined}>
          <td className="link-select-cell"><label className="link-select-target">
            <input type="checkbox" aria-label={`Select ${link.shortCode}`} disabled={disabled}
              checked={selected.includes(link.id)} onChange={(event) => onSelect(link.id, event.target.checked)} />
          </label></td>
          <td className="workspace-link-info">
            <Link to={link.id}><span className="bento-link-icon"><Icon name="link" size={15} /></span>{link.shortCode}</Link>
            <p className="workspace-destination" title={link.destination}>{link.destination}</p>
            {link.tags.length > 0 && <ul className="tag-list" aria-label="Tags">
              {link.tags.map((tag) => <li className="tag-pill" key={tag}>{tag}</li>)}
            </ul>}
          </td>
          <td><StatusBadge status={link.status} /></td>
          <td><time dateTime={link.createdAt}>{new Date(link.createdAt).toLocaleDateString(undefined,
            { month: 'short', day: 'numeric', year: 'numeric' })}</time></td>
          <td>
            <ActionDisclosure className="link-row-actions" label={`Actions for ${link.shortCode}`} trigger={<Icon name="more" />}>
              <button type="button" onClick={() => void onCopy(link.shortPath)}><Icon name="copy" />Copy short URL</button>
              <a href={publicShortUrl(link.shortPath)} target="_blank" rel="noopener noreferrer">
                <Icon name="external" />Open short URL<span className="workspace-sr-only"> (new tab)</span>
              </a>
              <Link to={link.id}><Icon name="link" />Link details</Link>
              <Link to={`${link.id}/qr`}><Icon name="qr" />QR Studio</Link>
            </ActionDisclosure>
          </td>
        </tr>
      ))}</tbody>
    </table>
  );
}
