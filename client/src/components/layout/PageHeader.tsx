import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, actions, breadcrumb, className }: PageHeaderProps) => (
  <div className={cn('mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      {breadcrumb && <div className="mb-1 text-2xs text-muted">{breadcrumb}</div>}
      <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
