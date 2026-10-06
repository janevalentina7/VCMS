import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padded?: boolean;
}

export const Card = ({ className, hoverable, padded = true, ...props }: CardProps) => (
  <div className={cn('card', hoverable && 'card-hover', padded && 'card-pad', className)} {...props} />
);

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export const CardHeader = ({ title, subtitle, action, icon, className }: CardHeaderProps) => (
  <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
    <div className="flex min-w-0 items-start gap-3">
      {icon && <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">{icon}</span>}
      <div className="min-w-0">
        <h2 className="panel-title">{title}</h2>
        {subtitle && <p className="panel-subtitle mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export default Card;
