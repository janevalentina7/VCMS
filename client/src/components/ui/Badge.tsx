import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PRIORITY_META, STATUS_META } from '@/lib/constants';
import type { ComplaintStatus, Priority } from '@/types';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  dot?: boolean;
  title?: string;
}

export const Badge = ({ children, className, dot, title }: BadgeProps) => (
  <span className={cn('badge', className)} title={title}>
    {dot && <span className={cn('badge-dot', dot === true ? 'bg-current' : '')} aria-hidden />}
    {children}
  </span>
);

export const StatusBadge = ({ status, label, className }: { status: ComplaintStatus; label?: string; className?: string }) => {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn('badge', meta?.className, className)}
      title={`Status: ${meta?.label ?? status}`}
    >
      <span className={cn('badge-dot', meta?.dot)} aria-hidden />
      {label ?? meta?.label ?? status}
    </span>
  );
};

export const PriorityBadge = ({ priority, label, className }: { priority: Priority; label?: string; className?: string }) => {
  const meta = PRIORITY_META[priority];
  return (
    <span className={cn('badge', meta?.className, className)} title={`Priority: ${meta?.label ?? priority}`}>
      <span className={cn('badge-dot', meta?.dot)} aria-hidden />
      {label ?? meta?.label ?? priority}
    </span>
  );
};

/** Small horizontal urgency meter used in tables and dashboards. */
export const PriorityMeter = ({ priority, className }: { priority: Priority; className?: string }) => {
  const level = { low: 1, medium: 2, high: 3, critical: 4 }[priority] ?? 1;
  const meta = PRIORITY_META[priority];
  return (
    <span className={cn('inline-flex items-center gap-1', className)} title={`${meta?.label} priority`}>
      {[1, 2, 3, 4].map((step) => (
        <span key={step} className={cn('h-1.5 w-3 rounded-full', step <= level ? meta?.bar : 'bg-line')} aria-hidden />
      ))}
      <span className="sr-only">{meta?.label} priority</span>
    </span>
  );
};

export default Badge;
