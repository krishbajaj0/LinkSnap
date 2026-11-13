import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import '../styles/pages.css';

export default function AuthPage({ mode }) {
  const registering = mode === 'register';
  const title = registering ? 'Create an account' : 'Log in';
  const { status, signIn } = useAuth();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestedPath = location.state?.from;
  const destination = /^\/dashboard(?:\/(?:links(?:\/[a-f0-9]{24}(?:\/qr)?)?|analytics(?:\/links\/[a-f0-9]{24})?|settings))?$/.test(requestedPath)
    ? requestedPath
    : '/dashboard';

  if (status === 'authenticated') return <Navigate replace to={destination} />;
  if (status === 'loading') return <p className="public-panel" role="status">Checking your session…</p>;

  async function submit(event) {
    event.preventDefault();
    if ((registering && [...password].length < 12) || new TextEncoder().encode(password).length > 72) {
      setError(registering ? 'Use at least 12 characters and no more than 72 UTF-8 bytes.' : 'Enter a valid password.');
      return;
    }
    setError('');
    setPending(true);
    try {
      await signIn(mode, { name, email, password });
    } catch (failure) {
      setError(failure.status ? failure.message : 'Could not reach the authentication service. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="public-panel auth-panel" aria-labelledby="auth-title">
      <h1 id="auth-title">{title}</h1>
      <form aria-labelledby="auth-title" aria-busy={pending} onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <fieldset disabled={pending}>
          {registering && (
            <label>
              Name
              <input name="name" required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          )}
          <label>
            Email address
            <input name="email" required maxLength={254} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input name="password" required type={visible ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={registering ? 'password-hint' : undefined} />
          </label>
          {registering && <p id="password-hint">Use at least 12 characters.</p>}
          <label className="password-toggle">
            <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
            Show password
          </label>
          <button type="submit" className="primary-btn">{pending ? 'Please wait…' : title}</button>
        </fieldset>
      </form>
      <p>
        {registering ? 'Already have an account? ' : 'New to LinkSnap? '}
        <Link className="text-link" to={registering ? '/login' : '/register'} state={location.state}>
          {registering ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </section>
  );
}
