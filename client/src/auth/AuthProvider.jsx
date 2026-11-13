import { useCallback, useEffect, useRef, useState } from 'react';
import { authRequest, withSessionLock } from '../services/auth.js';
import { AuthContext } from './useAuth.js';

export default function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });
  const access = useRef(null);
  const inFlight = useRef(null);

  const apply = useCallback((session) => {
    access.current = session?.accessToken ?? null;
    setState({ status: session ? 'authenticated' : 'anonymous', user: session?.user ?? null });
    return access.current;
  }, []);

  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const operation = withSessionLock(async () => {
      try {
        let session;
        try {
          session = await authRequest('/refresh', { method: 'POST' });
        } catch (error) {
          if (error.code !== 'REFRESH_CONFLICT') throw error;
          await new Promise((resolve) => setTimeout(resolve, 200));
          session = await authRequest('/refresh', { method: 'POST' });
        }
        return apply(session);
      } catch (error) {
        if (error.status === 401) return apply(null);
        throw error;
      }
    });
    inFlight.current = operation.finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [apply]);

  const restore = useCallback(() => {
    setState({ status: 'loading', user: null });
    return refresh().catch(() => setState({ status: 'unavailable', user: null }));
  }, [refresh]);

  useEffect(() => {
    let active = true;
    refresh().catch(() => {
      if (active) setState({ status: 'unavailable', user: null });
    });
    return () => { active = false; };
  }, [refresh]);

  const authenticatedRequest = useCallback(async (path, options) => {
    const token = access.current ?? await refresh();
    if (!token) throw new Error('Please sign in to continue.');
    try {
      return await authRequest(path, { ...options, token });
    } catch (error) {
      if (error.code !== 'UNAUTHENTICATED') throw error;
      const renewed = access.current && access.current !== token ? access.current : await refresh();
      if (!renewed) throw error;
      return authRequest(path, { ...options, token: renewed });
    }
  }, [refresh]);

  function signIn(mode, body) {
    return withSessionLock(async () => {
      apply(await authRequest(`/${mode}`, { method: 'POST', body }));
    });
  }

  function logout() {
    return withSessionLock(async () => {
      await authRequest('/logout', { method: 'POST' });
      apply(null);
    });
  }

  async function endAllSessions(path, options) {
    await authenticatedRequest(path, options);
    apply(null);
  }

  return (
    <AuthContext.Provider value={{ ...state, restore, signIn, logout, authenticatedRequest, endAllSessions }}>
      {children}
    </AuthContext.Provider>
  );
}
