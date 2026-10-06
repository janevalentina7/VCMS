import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'vcms.theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const systemPrefersDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyTheme = (dark: boolean) => {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1120' : '#10367a');
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      return stored ?? 'system';
    } catch {
      return 'system';
    }
  });
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => {
    if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return mode;
  });

  useEffect(() => {
    const next = mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
    setResolved(next);
    applyTheme(next === 'dark');
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'system') return undefined;
    const list = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const dark = list.matches;
      setResolved(dark ? 'dark' : 'light');
      applyTheme(dark);
    };
    list.addEventListener('change', handler);
    return () => list.removeEventListener('change', handler);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const toggle = useCallback(() => setModeState((current) => (current === 'dark' ? 'light' : current === 'light' ? 'dark' : systemPrefersDark() ? 'light' : 'dark')), []);

  const value = useMemo(() => ({ mode, resolved, setMode, toggle }), [mode, resolved, setMode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
