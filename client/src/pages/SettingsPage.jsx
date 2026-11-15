import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { CardHeading, LoadingState, PageHeader } from '../components/dashboard/WorkspaceUi.jsx';
import { passwordError, passwordRequirements } from '../services/password.js';
import '../styles/settings.css';

export default function SettingsPage() {
  const { logout, authenticatedRequest, endAllSessions, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [sessionError, setSessionError] = useState('');
  const [visible, setVisible] = useState(false);
  const inFlight = useRef(false);
  const sessionsDialog = useRef(null);
  const sessionsTrigger = useRef(null);
  const currentInput = useRef(null);
  const newInput = useRef(null);

  useEffect(() => {
    const request = new AbortController();
    authenticatedRequest('/me', { signal: request.signal }).then(({ user }) => {
      if (request.signal.aborted) return;
      setProfile(user);
      setName(user.name);
    }).catch(() => {
      if (!request.signal.aborted) setProfileError('Could not load your profile. Try again.');
    });
    return () => request.abort();
  }, [authenticatedRequest, attempt]);

  async function run(key, action, reportError) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(key);
    try {
      await action();
    } catch (failure) {
      reportError(failure.status ? failure.message : 'Could not complete the request. Try again.');
    } finally {
      inFlight.current = false;
      setPending('');
    }
  }

  function saveProfile(event) {
    event.preventDefault();
    if (inFlight.current || !profile) return;
    setProfileNotice('');
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 80) {
      setProfileError('Enter a name up to 80 characters.');
      event.currentTarget.elements.namedItem('name').focus();
      return;
    }
    if (trimmedName === profile.name) return;
    setProfileError('');
    void run('profile', async () => {
      const { user } = await authenticatedRequest('/me', { method: 'PATCH', body: { name: trimmedName } });
      setProfile(user);
      setName(user.name);
      updateProfile(user);
      setProfileNotice('Profile saved.');
    }, setProfileError);
  }

  function changePassword(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const { currentPassword, newPassword } = Object.fromEntries(new FormData(event.currentTarget));
    const current = passwordError(currentPassword);
    const next = passwordError(newPassword, true)
      || (currentPassword === newPassword ? 'Choose a different password.' : '');
    setPasswordErrors({ current, next });
    if (current || next) {
      (current ? currentInput : newInput).current.focus();
      return;
    }
    void run('password', () => endAllSessions('/change-password', {
      method: 'PATCH', body: { currentPassword, newPassword },
    }, 'Password changed. Log in with your new password.'), (form) => setPasswordErrors({ form }));
  }

  function signOut(all = false) {
    setSessionError('');
    void run(all ? 'all' : 'logout', all
      ? () => endAllSessions('/logout-all', { method: 'POST' }, 'You’ve been logged out on all devices.')
      : logout, setSessionError);
  }

  return (
    <section className="settings-page workspace-subpage" aria-labelledby="settings-title">
      <PageHeader id="settings-title" title="Settings" description="Manage your profile, password and sign-ins." />
      <div className="settings-grid">
        <section className="dashboard-panel workspace-card auth-panel" aria-labelledby="profile-heading">
          <CardHeading id="profile-heading" title="Profile" icon="visitors">Your display name and account email.</CardHeading>
          {!profile && !profileError && <LoadingState>Loading your profile…</LoadingState>}
          {profileError && <p id="profile-error" className="form-error" role="alert">{profileError}</p>}
          {!profile && profileError && <button className="secondary-btn" type="button" onClick={() => {
            setProfileError('');
            setAttempt((value) => value + 1);
          }}>Reload profile</button>}
          {profile && (
            <form onSubmit={saveProfile} aria-labelledby="profile-heading" aria-busy={pending === 'profile'}>
              <fieldset disabled={Boolean(pending)}>
                <label>Name (required)
                  <input name="name" autoComplete="name" required maxLength={80} value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setProfileError('');
                      setProfileNotice('');
                    }} aria-invalid={Boolean(profileError)} aria-describedby={profileError ? 'profile-error' : undefined} />
                </label>
                <dl className="profile-email"><dt>Email address</dt><dd>{profile.email}</dd></dl>
                <button className="primary-btn" type="submit" disabled={name === profile.name}>
                  {pending === 'profile' ? 'Saving…' : 'Save name'}
                </button>
              </fieldset>
            </form>
          )}
          {profileNotice && <p className="form-success" role="status">{profileNotice}</p>}
        </section>
        <section className="dashboard-panel workspace-card auth-panel" aria-labelledby="password-heading">
          <CardHeading id="password-heading" title="Password & security" icon="shield">
            Changing your password signs you out on all devices.
          </CardHeading>
          <form onSubmit={changePassword} aria-labelledby="password-heading" aria-busy={pending === 'password'}>
            {passwordErrors.form && <p className="form-error" role="alert">{passwordErrors.form}</p>}
            <fieldset disabled={Boolean(pending)}>
              <label>Current password (required)
                <input ref={currentInput} name="currentPassword" type={visible ? 'text' : 'password'} required
                  autoComplete="current-password" aria-invalid={Boolean(passwordErrors.current)}
                  aria-describedby={passwordErrors.current ? 'current-password-error' : undefined} />
              </label>
              {passwordErrors.current && <p id="current-password-error" role="alert" className="form-error">{passwordErrors.current}</p>}
              <label>New password (required)
                <input ref={newInput} name="newPassword" type={visible ? 'text' : 'password'} required
                  autoComplete="new-password" aria-invalid={Boolean(passwordErrors.next)}
                  aria-describedby={passwordErrors.next ? 'settings-password-hint new-password-error' : 'settings-password-hint'} />
              </label>
              <p id="settings-password-hint" className="field-hint">{passwordRequirements}</p>
              {passwordErrors.next && <p id="new-password-error" role="alert" className="form-error">{passwordErrors.next}</p>}
              <label className="password-toggle">
                <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
                Show passwords
              </label>
              <button className="primary-btn" type="submit">{pending === 'password' ? 'Changing password…' : 'Change password'}</button>
            </fieldset>
          </form>
        </section>
        <section className="dashboard-panel workspace-card settings-sessions" aria-labelledby="sessions-heading" aria-busy={pending === 'logout' || pending === 'all'}>
          <CardHeading id="sessions-heading" title="Sessions" icon="signout">
            Log out of this browser, or revoke your sessions on every device.
          </CardHeading>
          {sessionError && <p className="form-error" role="alert">{sessionError}</p>}
          <div className="action-group">
            <button className="secondary-btn" type="button" disabled={Boolean(pending)} onClick={() => signOut()}>
              {pending === 'logout' ? 'Logging out…' : 'Log out'}
            </button>
            <button ref={sessionsTrigger} className="secondary-btn" type="button" disabled={Boolean(pending)}
              onClick={() => sessionsDialog.current.showModal()}>
              {pending === 'all' ? 'Logging out on all devices…' : 'Log out on all devices'}
            </button>
          </div>
          <ConfirmDialog dialogRef={sessionsDialog} title="Log out on all devices?"
            description="This revokes every active session, including this browser. You’ll need to log in again on each device."
            confirmLabel="Log out everywhere" onConfirm={() => signOut(true)}
            onClose={() => sessionsTrigger.current?.focus()} />
        </section>
      </div>
    </section>
  );
}
