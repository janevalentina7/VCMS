import { cn } from '@/lib/utils';

/** Portal emblem + wordmark used in the sidebar, topbar and landing page. */
export const Logo = ({ className, compact = false, tone = 'default' }: { className?: string; compact?: boolean; tone?: 'default' | 'light' }) => (
  <span className={cn('flex items-center gap-3', className)}>
    <span
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
        tone === 'light' ? 'bg-white/15 text-white ring-1 ring-white/25' : 'bg-primary text-primary-fg shadow-card',
      )}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="h-6 w-6" role="img" aria-label="VCMS emblem">
        <path d="M32 10l19 9.5v6H13v-6L32 10z" fill="currentColor" />
        <rect x="17" y="30" width="5" height="17" rx="1" fill="currentColor" />
        <rect x="29.5" y="30" width="5" height="17" rx="1" fill="currentColor" />
        <rect x="42" y="30" width="5" height="17" rx="1" fill="currentColor" />
        <rect x="11" y="50" width="42" height="4.5" rx="2" fill="#b91c1c" />
      </svg>
    </span>
    {!compact && (
      <span className="min-w-0 leading-tight">
        <span className={cn('block truncate text-sm font-bold tracking-tight', tone === 'light' ? 'text-white' : 'text-ink')}>
          Government of Tamil Nadu
        </span>
        <span className={cn('block truncate text-2xs', tone === 'light' ? 'text-white/75' : 'text-muted')}>
          Village Complaint Management System
        </span>
      </span>
    )}
  </span>
);

export default Logo;
