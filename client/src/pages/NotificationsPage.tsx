import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CheckCheck, Filter, Inbox, MailOpen, Trash2 } from 'lucide-react';
import { api, buildQuery } from '@/lib/api';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useNotifications } from '@/context/NotificationContext';
import { useToast } from '@/context/ToastContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Tabs from '@/components/ui/Tabs';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import type { AppNotification, Pagination as PaginationMeta } from '@/types';

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
};

const TYPE_LABELS: Record<string, string> = {
  complaint_registered: 'Complaint registered',
  complaint_assigned: 'Complaint assigned',
  status_updated: 'Status updated',
  complaint_resolved: 'Complaint resolved',
  complaint_rejected: 'Complaint rejected',
  remark_added: 'Remark added',
  complaint_approved: 'Complaint approved',
  user_welcome: 'Welcome',
  account_updated: 'Account updated',
};

/** Notification centre (§17): unread filter, read/unread actions and pagination. */
export const NotificationsPage = () => {
  const toast = useToast();
  const { markAllRead, refresh: refreshBadge, unreadCount: globalUnread } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const query = useMemo(() => buildQuery({ unreadOnly: filter === 'unread' ? 'true' : undefined, page, pageSize: 12 }), [filter, page]);
  const { data, loading, error, reload } = useAsync<{ items: AppNotification[]; pagination: PaginationMeta; unread: number }>(
    async (signal) => {
      const result = await api.getWithMeta<AppNotification[]>(`/notifications?${query}`, signal);
      return {
        items: result.data ?? [],
        unread: result.meta?.unreadCount ?? 0,
        pagination: result.meta?.pagination ?? { page, pageSize: 12, total: result.data?.length ?? 0, totalPages: 1, hasNext: false, hasPrev: false },
      };
    },
    [query, refreshKey],
  );

  const refreshAll = () => {
    reload();
    setRefreshKey((key) => key + 1);
    void refreshBadge();
  };

  const notifications = data?.items ?? [];
  const pagination = data?.pagination ?? { page, pageSize: 12, total: 0, totalPages: 1, hasNext: false, hasPrev: false };

  const markRead = async (notification: AppNotification, isRead = true) => {
    try {
      await api.put(`/notifications/${notification.id}/read`, { isRead });
      refreshAll();
    } catch {
      toast.error('Could not update notification', 'Please try again.');
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Every complaint update is recorded here — registration, approval, assignment, remarks and resolution."
        actions={
          <>
            <Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} onClick={async () => { await markAllRead(); toast.success('All marked as read'); refreshAll(); }} disabled={(data?.unread ?? 0) === 0 && globalUnread === 0}>
              Mark all read
            </Button>
            <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={refreshAll}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          ariaLabel="Filter notifications"
          active={filter}
          onChange={(id) => {
            setFilter(id as 'all' | 'unread');
            setPage(1);
          }}
          tabs={[
            { id: 'all', label: 'All notifications' },
            { id: 'unread', label: 'Unread', count: data?.unread ?? 0 },
          ]}
        />
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          {pagination.total} notification(s)
        </span>
      </div>

      <Card>
        {loading ? (
          <ul className="space-y-4">
            {[0, 1, 2, 3].map((index) => (
              <li key={index} className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={filter === 'unread' ? <MailOpen className="h-7 w-7" /> : <Inbox className="h-7 w-7" />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            description={
              filter === 'unread'
                ? 'You have read every notification. New updates will appear here automatically.'
                : 'Updates about your complaints — approvals, assignments, remarks and resolutions — will appear here.'
            }
            action={
              <Link to="/complaints" className="btn btn-secondary">
                Go to my complaints
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-line/70">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={cn('flex flex-col gap-3 py-4 transition-colors sm:flex-row sm:items-start', !notification.isRead && 'bg-primary-soft/25')}
              >
                <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', SEVERITY_STYLES[notification.severity] ?? 'bg-info')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('text-sm', notification.isRead ? 'font-medium text-ink' : 'font-semibold text-ink')}>{notification.title}</p>
                    <Badge className="border-line bg-elevated text-muted">{TYPE_LABELS[notification.type] ?? notification.type}</Badge>
                    {!notification.isRead && <Badge className="border-primary/30 bg-primary-soft text-primary">Unread</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{notification.message}</p>
                  <p className="mt-1 text-2xs text-muted">
                    {formatDateTime(notification.createdAt)}
                    <span className="mx-1.5 text-line">|</span>
                    <span title={notification.createdAt}>{formatRelative(notification.createdAt)}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {notification.link && (
                      <Link to={notification.link} className="btn btn-secondary btn-sm" onClick={() => !notification.isRead && markRead(notification, true)}>
                        Open complaint
                      </Link>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => markRead(notification, !notification.isRead)}>
                      {notification.isRead ? 'Mark as unread' : 'Mark as read'}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {notifications.length > 0 && (
          <Pagination meta={pagination} onPageChange={setPage} itemLabel="notifications" />
        )}
      </Card>

      <Card className="mt-5 border-primary/25 bg-primary-soft/30">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <BellRing className="h-4 w-4 text-primary" aria-hidden /> Notification channels
        </p>
        <p className="mt-1 text-xs text-muted">
          In-app notifications are always on. Email and SMS delivery can be enabled by configuring provider credentials on the server
          (<span className="kbd">SMTP_URL</span>, <span className="kbd">SMS_API_KEY</span>) — the dispatch layer is already wired.
          Manage your preferences in{' '}
          <Link to="/settings" className="link">
            Settings
          </Link>
          .
        </p>
      </Card>
    </>
  );
};

export default NotificationsPage;
