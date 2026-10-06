import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState = ({ title, description, icon, action, className, compact }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-14', className)}>
    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary" aria-hidden>
      {icon ?? <Inbox className="h-7 w-7" />}
    </span>
    <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
    {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState = ({ title = 'Unable to load data', message, onRetry, className }: ErrorStateProps) => (
  <EmptyState
    className={className}
    icon={<span className="text-2xl">⚠️</span>}
    title={title}
    description={message ?? 'Something went wrong while contacting the server. Please try again.'}
    action={
      onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )
    }
  />
);

export default EmptyState;
