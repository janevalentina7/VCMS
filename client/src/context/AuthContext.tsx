import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, bootstrapCsrf } from '@/lib/api';
import type { AuthResponse, Branding, SessionUser } from '@/types';

interface AuthContextValue {
  user: SessionUser | null;
  branding: Branding | null;
  loading: boolean;
  login: (identifier: string, password: string, remember?: boolean) => Promise<SessionUser>;
  register: (payload: Record<string, unknown>) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: SessionUser) => void;
  hasRole: (...roles: SessionUser['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      await bootstrapCsrf();
      const [payload, publicBranding] = await Promise.all([
        api.get<{ user: SessionUser; branding: Branding }>('/auth/me'),
        api.get<Branding>('/public/branding').catch(() => null),
      ]);
      setUser(payload.user);
      setBranding(payload.branding ?? publicBranding ?? null);
    } catch {
      // Anonymous visitors are expected here - only branding is required.
      setUser(null);
      try {
        setBranding(await api.get<Branding>('/public/branding'));
      } catch {
        setBranding(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (identifier: string, password: string, remember = false) => {
    const result = await api.post<AuthResponse>('/auth/login', { identifier, password, remember });
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (payload: Record<string, unknown>) => {
    const result = await api.post<AuthResponse>('/auth/register', payload);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const payload = await api.get<{ user: SessionUser }>('/auth/me');
    setUser(payload.user);
  }, []);

  const hasRole = useCallback((...roles: SessionUser['role'][]) => Boolean(user && roles.includes(user.role)), [user]);

  const value = useMemo(
    () => ({ user, branding, loading, login, register, logout, refreshUser, setUser, hasRole }),
    [user, branding, loading, login, register, logout, refreshUser, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
