import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';
import type { AppNotification } from '@/types';

interface NotificationContextValue {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number, isRead?: boolean) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const POLL_INTERVAL_MS = 45_000;

/** Keeps the bell badge in sync without hammering the API. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    try {
      setLoading(true);
      const result = await api.getWithMeta<AppNotification[]>('/notifications?pageSize=12');
      setItems(result.data ?? []);
      setUnreadCount(result.meta?.unreadCount ?? (result.data ?? []).filter((n) => !n.isRead).length);
    } catch {
      /* silent - the bell simply stays as it was */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    if (!user) return undefined;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh, user]);

  const markRead = useCallback(
    async (id: number, isRead = true) => {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead } : item)));
      setUnreadCount((count) => Math.max(0, count + (isRead ? -1 : 1)));
      try {
        await api.put(`/notifications/${id}/read`, { isRead });
      } catch {
        await refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    try {
      await api.put('/notifications/read-all', {});
    } catch {
      await refresh();
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return context;
}
