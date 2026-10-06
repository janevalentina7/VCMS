import { Link } from 'react-router-dom';
import { BellOff, CheckCheck, Inbox } from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import { useNotifications } from '@/context/NotificationContext';
import Button from '@/components/ui/Button';

const SEVERITY_DOT = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
};

/** Notification dropdown with unread state, timestamps and read actions (§17). */
export const NotificationCenter = ({ onClose }: { onClose: () => void }) => {
  const { items, unreadCount, loading, markAllRead, markRead } = useNotifications();

  return (
    <div className="fixed inset-x-3 top-[68px] z-50 animate-fade-in-up overflow-hidden rounded-xl border border-line bg-surface shadow-raised sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[380px]">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Notifications</p>
          <p className="text-2xs text-muted">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={() => void markAllRead()}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="max-h-[380px] overflow-y-auto">
        {loading && !items.length ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex gap-3">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-2/3" />
                  <div className="skeleton h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellOff className="h-7 w-7 text-muted" aria-hidden />
            <p className="text-sm font-medium text-ink">No notifications</p>
            <p className="text-xs text-muted">Updates about your complaints will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.link ?? '/notifications'}
                  onClick={() => {
                    if (!item.isRead) void markRead(item.id, true);
                    onClose();
                  }}
                  className={cn('flex gap-3 px-4 py-3 transition-colors hover:bg-primary-soft/40', !item.isRead && 'bg-primary-soft/25')}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', SEVERITY_DOT[item.severity] ?? 'bg-info')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-xs', item.isRead ? 'font-medium text-ink' : 'font-semibold text-ink')}>{item.title}</span>
                      <span className="shrink-0 text-2xs text-muted">{formatRelative(item.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-2xs leading-relaxed text-muted">{item.message}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line p-2">
        <Link
          to="/notifications"
          onClick={onClose}
          className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft"
        >
          <Inbox className="h-3.5 w-3.5" aria-hidden />
          View all notifications
        </Link>
      </div>
    </div>
  );
};

export default NotificationCenter;
