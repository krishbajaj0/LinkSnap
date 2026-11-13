import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';

export default function SettingsPage() {
  const { user, logout, authenticatedRequest, endAllSessions } = useAuth();
  const [profile, setProfile] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    let active = true;
    authenticatedRequest('/me').then(({ user: current }) => {
      if (active) setProfile(current);
    }).catch(() => {
      if (active) setError('Could not load your latest profile.');
    });
    return () => { active = false; };
  }, [authenticatedRequest]);

  async function run(action) {
    setPending(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure.status ? failure.message : 'Could not complete the request. Try again.');
    } finally {
      setPending(false);
    }
  }

  function changePassword(event) {
    event.preventDefault();
    void run(() => endAllSessions('/change-password', {
      method: 'PATCH', body: { currentPassword, newPassword },
    }));
  }

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <h1 id="settings-title">Settings</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dashboard-panel">
        <h2>Profile</h2>
        <p>{(profile ?? user).name}</p>
        <p>{(profile ?? user).email}</p>
      </div>
      <div className="dashboard-panel auth-panel">
        <h2 id="password-heading">Change password</h2>
        <p>Changing your password signs you out on all devices.</p>
        <form onSubmit={changePassword} aria-labelledby="password-heading" aria-busy={pending}>
          <fieldset disabled={pending}>
            <label>
              Current password
              <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label>
              New password
              <input type="password" required minLength={12} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <button className="primary-btn" type="submit">Change password</button>
          </fieldset>
        </form>
      </div>
      <div className="dashboard-panel">
        <h2>Sessions</h2>
        <div className="session-actions">
          <button className="primary-btn" type="button" disabled={pending} onClick={() => void run(logout)}>Log out</button>
          <button className="primary-btn" type="button" disabled={pending} onClick={() => void run(() => endAllSessions('/logout-all', { method: 'POST' }))}>Log out on all devices</button>
        </div>
      </div>
    </section>
  );
}
