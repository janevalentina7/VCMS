import { NavLink } from 'react-router-dom';
import { X, Building2, ShieldCheck } from 'lucide-react';
import { NAV_ITEMS, ROLE_META } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { categoryIcon } from '@/lib/constants';
import { CATEGORY_FALLBACK } from '@/lib/constants';
import Logo from './Logo';
import type { Category } from '@/types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  categories?: Category[];
}

export const Sidebar = ({ open, onClose, categories = [] }: SidebarProps) => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const role = user?.role ?? 'citizen';

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const shownCategories = categories.length
    ? categories.map((c) => ({ name: c.name, icon: c.icon, colour: c.colour, slug: c.slug, count: c.complaintCount }))
    : CATEGORY_FALLBACK.map((c) => ({ name: c.name, icon: c.icon, colour: c.colour, slug: c.slug, count: undefined }));

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        id="vcms-sidebar"
        aria-label="Main navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-line bg-surface transition-transform duration-300 ease-smooth lg:translate-x-0',
          open ? 'translate-x-0 shadow-raised' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
          <Logo />
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-ink lg:hidden"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) => cn('nav-link mb-0.5', isActive && 'nav-link-active')}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge === 'notifications' && unreadCount > 0 && (
                  <span className="rounded-full bg-danger px-1.5 py-0.5 text-2xs font-bold text-white" aria-label={`${unreadCount} unread`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}

          <p className="nav-section">Complaint Categories</p>
          <ul className="space-y-0.5">
            {shownCategories.map((category) => {
              const Icon = categoryIcon(category.icon);
              return (
                <li key={category.slug}>
                  <NavLink
                    to={`/complaints?category=${category.slug}`}
                    onClick={onClose}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted transition-colors hover:bg-primary-soft/60 hover:text-ink"
                  >
                    <Icon className="h-4 w-4 shrink-0" style={{ color: category.colour }} aria-hidden />
                    <span className="flex-1 truncate">{category.name}</span>
                    {typeof category.count === 'number' && <span className="text-2xs font-semibold">{category.count}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          <p className="nav-section">Village Administration</p>
          <div className="rounded-xl border border-line bg-elevated/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden />
              Kattupakkam Village Panchayat
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              {user?.wardName ? `Your ward: ${user.wardName}` : 'Ward information is not linked to your profile yet.'}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-2xs text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
              Signed in as {ROLE_META[role].label}
            </p>
          </div>
        </nav>

        <div className="border-t border-line px-4 py-3 text-2xs leading-relaxed text-muted">
          Digital Grievance Redressal Portal
          <br />
          <span className="text-muted/80">Demonstration build — not an official government service.</span>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
