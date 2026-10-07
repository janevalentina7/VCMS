import type { ReactNode } from 'react';
import Card from '@/components/ui/Card';
import { SkeletonChart } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
  className?: string;
  height?: number;
}

/** Consistent frame for every chart: title, loading skeleton, empty state. */
export const ChartCard = ({ title, subtitle, action, loading, empty, emptyMessage, children, className, height = 288 }: ChartCardProps) => (
  <Card className={className} padded>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="panel-title">{title}</h2>
        {subtitle && <p className="panel-subtitle mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    {loading ? (
      <SkeletonChart style={{ height }} />
    ) : empty ? (
      <EmptyState compact title="No data to display" description={emptyMessage ?? 'Charts appear once complaints match the selected filters.'} />
    ) : (
      <div style={{ height }}>{children}</div>
    )}
  </Card>
);

export default ChartCard;
