import { Link } from 'react-router';

export default function Brand({ onClick }) {
  return (
    <Link className="public-brand" to="/" onClick={onClick}>
      <span className="brand-mark" aria-hidden="true" />
      LinkSnap
    </Link>
  );
}
