import { Link } from 'react-router';
import '../styles/pages.css';

export default function AuthPage({ mode }) {
  const registering = mode === 'register';
  const title = registering ? 'Create an account' : 'Log in';

  return (
    <section className="public-panel auth-panel" aria-labelledby="auth-title">
      <h1 id="auth-title">{title}</h1>
      <p id="auth-status" className="development-note">
        Under development. This form is a preview. Authentication will be available in Phase 4.
      </p>

      <form aria-labelledby="auth-title" aria-describedby="auth-status" onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled>
          {registering && (
            <label>
              Name
              <input name="name" autoComplete="name" />
            </label>
          )}
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} />
          </label>
          <button type="submit" className="primary-btn">{title}</button>
        </fieldset>
      </form>

      <p className="auth-switch">
        {registering ? 'Already have an account? ' : 'New to LinkSnap? '}
        <Link className="text-link" to={registering ? '/login' : '/register'}>
          {registering ? 'Log in' : 'View registration'}
        </Link>
      </p>
    </section>
  );
}
