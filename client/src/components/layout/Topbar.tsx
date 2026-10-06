import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Search, Settings, Sun, User as UserIcon, MonitorSmartphone, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_META } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useDismissable } from '@/hooks';
import Avatar from '@/components/ui/Avatar';
import NotificationCenter from './NotificationCenter';
import GlobalSearch from './GlobalSearch';

interface TopbarProps {
  onOpenSidebar: () => void;
  title?: string;
}

export const Topbar = ({ onOpenSidebar, title }: TopbarProps) => {
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  const notificationsRef = useDismissable<HTMLDivElement>(notificationsOpen, () => setNotificationsOpen(false));
  const profileRef = useDismissable<HTMLDivElement>(profileOpen, () => setProfileOpen(false));
  const themeRef = useDismissable<HTMLDivElement>(themeOpen, () => setThemeOpen(false));

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    toast.success('Signed out', 'You have been securely signed out of the portal.');
    navigate('/login', { replace: true });
  };

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: MonitorSmartphone },
  ] as const;

  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : MonitorSmartphone;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-ink lg:hidden"
          aria-label="Open navigation menu"
          aria-controls="vcms-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-ink sm:text-base">{title ?? 'Dashboard'}</h1>
          <p className="hidden truncate text-2xs text-muted sm:block">
            Government of Tamil Nadu • Village Complaint Management System
          </p>
        </div>

        <div className="hidden md:block md:w-72 lg:w-80">
          <GlobalSearch />
        </div>

        {/* Theme toggle */}
        <div className="relative" ref={themeRef}>
          <button
            type="button"
            onClick={() => setThemeOpen((open) => !open)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-ink"
            aria-label="Change colour theme"
            aria-expanded={themeOpen}
          >
            <ThemeIcon className="h-[18px] w-[18px]" />
          </button>
          {themeOpen && (
            <div className="absolute right-0 mt-2 w-40 animate-scale-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-raised">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setMode(option.id);
                      setThemeOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      mode === option.id ? 'bg-primary-soft font-semibold text-primary' : 'text-muted hover:bg-elevated hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-ink"
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
          {notificationsOpen && <NotificationCenter onClose={() => setNotificationsOpen(false)} />}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg p-1 pr-1.5 transition-colors hover:bg-elevated"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            <Avatar name={user?.name ?? 'User'} src={user?.avatarUrl} size="sm" />
            <span className="hidden text-left leading-tight lg:block">
              <span className="block max-w-[130px] truncate text-xs font-semibold text-ink">{user?.name}</span>
              <span className="block text-2xs text-muted">{user ? ROLE_META[user.role].label : ''}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted lg:block" aria-hidden />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 animate-scale-in overflow-hidden rounded-xl border border-line bg-surface shadow-raised">
              <div className="flex items-center gap-3 border-b border-line p-3">
                <Avatar name={user?.name ?? 'User'} src={user?.avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
                  <p className="truncate text-2xs text-muted">{user?.email}</p>
                  <span className={cn('badge mt-1', user ? ROLE_META[user.role].className : '')}>{user ? ROLE_META[user.role].label : ''}</span>
                </div>
              </div>
              <div className="p-1">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-elevated hover:text-ink"
                >
                  <UserIcon className="h-4 w-4" aria-hidden /> My Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-elevated hover:text-ink"
                >
                  <Settings className="h-4 w-4" aria-hidden /> Settings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search row */}
      <div className="border-t border-line px-3 py-2 md:hidden">
        <GlobalSearch compact />
      </div>
    </header>
  );
};

export default Topbar;
