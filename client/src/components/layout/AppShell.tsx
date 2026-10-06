import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useAsync, useIsDesktop } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import type { Category } from '@/types';

/** Page titles resolved from the route so the topbar always reflects context. */
const TITLES: { match: RegExp; title: string }[] = [
  { match: /^\/dashboard/, title: 'Dashboard' },
  { match: /^\/complaints\/new/, title: 'Register Complaint' },
  { match: /^\/complaints\/\d+/, title: 'Complaint Details' },
  { match: /^\/complaints/, title: 'View Complaints' },
  { match: /^\/track/, title: 'Track Complaint Status' },
  { match: /^\/reports/, title: 'Reports & Analytics' },
  { match: /^\/users/, title: 'User Management' },
  { match: /^\/officers/, title: 'Village Officers' },
  { match: /^\/wards/, title: 'Wards & Divisions' },
  { match: /^\/categories/, title: 'Complaint Categories' },
  { match: /^\/notifications/, title: 'Notifications' },
  { match: /^\/profile/, title: 'My Profile' },
  { match: /^\/settings/, title: 'Settings' },
];

const resolveTitle = (pathname: string) => TITLES.find((entry) => entry.match.test(pathname))?.title ?? 'Village Complaint Management System';

/**
 * Application shell: fixed sidebar (desktop) / collapsible drawer (mobile),
 * sticky topbar with search, notifications, theme and profile menus.
 */
export const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const toast = useToast();

  const { data: categories } = useAsync<Category[]>(
    (signal) => api.get<Category[]>('/categories', signal),
    [user?.id],
    { skip: !user },
  );

  // Close the mobile drawer on navigation and scroll to top on route change.
  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname, isDesktop]);

  useEffect(() => {
    void refreshNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface "session expired" events raised by the API layer.
  useEffect(() => {
    const handler = () => toast.warning('Session expired', 'Please sign in again to continue where you left off.');
    window.addEventListener('vcms:session-expired', handler);
    return () => window.removeEventListener('vcms:session-expired', handler);
  }, [toast]);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} categories={categories ?? []} />

      <div className="lg:pl-[272px]">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} title={resolveTitle(location.pathname)} />
        <main className="mx-auto w-full max-w-[1500px] animate-fade-in px-3 py-5 sm:px-5 sm:py-6 lg:px-7">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-8 pt-2 text-center text-2xs text-muted">
          Village Complaint Management System • Digital Grievance Redressal Portal •{' '}
          <span className="text-muted/80">Unofficial demonstration build</span>
        </footer>
      </div>

      {/* Floating scroll-to-top button for long mobile pages */}
      <a
        href="#root"
        onClick={(event) => {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="fixed bottom-5 right-4 z-30 hidden h-10 w-10 place-items-center rounded-full border border-line bg-surface text-muted shadow-raised transition-colors hover:text-ink sm:grid"
        aria-label="Back to top"
      >
        <X className="h-4 w-4 rotate-45" aria-hidden />
      </a>
    </div>
  );
};

export default AppShell;
