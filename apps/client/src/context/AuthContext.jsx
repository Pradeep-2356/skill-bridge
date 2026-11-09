import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, request, onSessionExpired } from '../services/apiClient.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);

/**
 * Knows who is logged in. On start-up it asks the API (GET /auth/me); the API
 * client silently renews an expired access token, so a returning user within
 * 7 days stays signed in across pages and browser restarts (SB1/US10).
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });
  const statusRef = useRef('loading');
  const toast = useToast();

  /** `reason` lets the route guard tell a deliberate logout from an expired session. */
  const setUser = useCallback((user, { reason = null } = {}) => {
    statusRef.current = user ? 'authenticated' : 'guest';
    setState({ status: statusRef.current, user, reason: user ? null : reason });
  }, []);

  useEffect(() => {
    let cancelled = false;
    request(api.get('/auth/me'))
      .then(({ data }) => !cancelled && setUser(data.user))
      .catch(() => !cancelled && setUser(null));
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  // Called by the API client when a session can no longer be renewed.
  useEffect(() => {
    onSessionExpired(() => {
      if (statusRef.current === 'authenticated') {
        setUser(null);
        toast.info('Your session has expired. Please log in again.', { title: 'Signed out' });
      }
    });
  }, [setUser, toast]);

  const login = useCallback(
    async (credentials) => {
      const { data } = await request(api.post('/auth/login', credentials));
      setUser(data.user);
      return data.user;
    },
    [setUser],
  );

  const register = useCallback(
    async (details) => {
      const { data } = await request(api.post('/auth/register', details));
      setUser(data.user);
      return data.user;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null, { reason: 'logout' });
    }
  }, [setUser]);

  const refreshUser = useCallback(async () => {
    const { data } = await request(api.get('/users/me'));
    setUser(data.user);
    return data.user;
  }, [setUser]);

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated: state.status === 'authenticated',
      isAdmin: state.user?.role === 'admin',
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [state, login, register, logout, refreshUser, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
