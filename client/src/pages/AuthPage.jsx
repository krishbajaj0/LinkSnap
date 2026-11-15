import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { passwordError, passwordRequirements } from '../services/password.js';
import '../styles/pages.css';
import '../styles/auth.css';

export default function AuthPage({ mode }) {
  const registering = mode === 'register';
  const title = registering ? 'Create your account' : 'Welcome back';
  const { status, signIn, notice } = useAuth();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [invalidPassword, setInvalidPassword] = useState(false);
  const requestedPath = location.state?.from;
  const destination = /^\/dashboard(?:\/(?:links(?:\/(?:qr|[a-f0-9]{24}(?:\/qr)?))?|analytics(?:\/links\/[a-f0-9]{24})?|settings|moderation))?$/.test(requestedPath)
    ? requestedPath
    : '/dashboard';

  if (status === 'authenticated') return <Navigate replace to={destination} />;
  if (status === 'loading') return <p className="public-panel account-loading" role="status">Checking your session…</p>;

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const passwordMessage = passwordError(password, registering);
    if (passwordMessage) {
      setInvalidPassword(true);
      setError(passwordMessage);
      event.currentTarget.elements.password.focus();
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
    <div className="account-layout public-container">
      <section className="public-panel auth-panel account-form" aria-labelledby="auth-title">
        <header>
          <h1 id="auth-title">{title}</h1>
          <p>{registering ? 'Get started with LinkSnap.' : 'Log in to your LinkSnap workspace.'}</p>
        </header>
        {!registering && notice && <p className="form-success" role="status">{notice}</p>}
        <form aria-labelledby="auth-title" aria-busy={pending} onSubmit={submit}>
          {error && <p id="auth-error" className="form-error" role="alert">{error}</p>}
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
            <div className="account-password">
              <label htmlFor="account-password">Password</label>
              <div>
                <input id="account-password" name="password" required type={visible ? 'text' : 'password'}
                  autoComplete={registering ? 'new-password' : 'current-password'} value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (invalidPassword) {
                      setInvalidPassword(false);
                      setError('');
                    }
                  }}
                  aria-invalid={invalidPassword || undefined}
                  aria-describedby={[registering && 'password-hint', invalidPassword && 'auth-error'].filter(Boolean).join(' ') || undefined} />
                <button type="button" className="account-password-toggle" aria-controls="account-password"
                  aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((shown) => !shown)}>
                  {visible ? 'Hide' : 'Show'}
                </button>
              </div>
              {registering && <p id="password-hint" className="field-hint">{passwordRequirements}</p>}
            </div>
            <button type="submit" className="primary-btn public-button">
              {pending ? 'Please wait…' : registering ? 'Create account' : 'Log in'}
              {!pending && <span aria-hidden="true">→</span>}
            </button>
          </fieldset>
        </form>
        <p className="account-switch">
          {registering ? 'Already have an account? ' : 'New to LinkSnap? '}
          <Link className="text-link" to={registering ? '/login' : '/register'} state={location.state}>
            {registering ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </section>
      <aside className="account-context" aria-labelledby="account-context-title">
        <span className="brand-mark" aria-hidden="true" />
        <h2 id="account-context-title">Your links, all in one place.</h2>
        <ul>
          <li><span className="product-icon icon-link" aria-hidden="true" /> Short links with custom aliases</li>
          <li><span className="product-icon icon-analytics" aria-hidden="true" /> Click and referrer analytics</li>
          <li><span className="product-icon icon-qr" aria-hidden="true" /> Custom QR codes for sharing</li>
        </ul>
      </aside>
    </div>
  );
}
