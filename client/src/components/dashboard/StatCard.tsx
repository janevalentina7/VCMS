import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import Card from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: 'primary' | 'warning' | 'info' | 'success' | 'danger' | 'neutral';
  trend?: number | null;
  trendLabel?: string;
  hint?: string;
  loading?: boolean;
  onClick?: () => void;
}

const TONES = {
  primary: 'bg-primary-soft text-primary',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-elevated text-muted',
};

const TREND_COLOURS = {
  up: 'text-success',
  down: 'text-danger',
  flat: 'text-muted',
};

/**
 * Dashboard summary card with icon, animated count, trend indicator (§6).
 * The trend is intentionally neutral in wording ("this month") because the
 * underlying metric is a month-over-month comparison.
 */
export const StatCard = ({ label, value, icon, tone = 'primary', trend, trendLabel = 'this month', hint, loading, onClick }: StatCardProps) => {
  const direction = trend === null || trend === undefined ? 'flat' : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';
  const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  const content = (
    <>
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          {loading ? (
            <div className="skeleton mt-2 h-7 w-16" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight text-ink transition-transform duration-300 group-hover:scale-[1.02] sm:text-[26px]">
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
          )}
          {trend !== undefined && (
            <p className={cn('mt-1 flex items-center gap-1 text-2xs font-medium', TREND_COLOURS[direction])}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden />
              {trend === null ? 'No comparison available' : `${trend > 0 ? '+' : ''}${trend}% ${trendLabel}`}
            </p>
          )}
          {hint && <p className="mt-1 text-2xs text-muted">{hint}</p>}
        </div>
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-3', TONES[tone])} aria-hidden>
          {icon}
        </span>
    </>
  );

  if (onClick) {
    return (
      <Card hoverable className="group relative cursor-pointer overflow-hidden text-left" padded>
        <button type="button" onClick={onClick} className="flex w-full items-start justify-between gap-3 focus-visible:outline-none" aria-label={`${label}: ${value}`}>
          {content}
        </button>
      </Card>
    );
  }

  return (
    <Card hoverable className="group relative overflow-hidden" padded>
      <div className="flex w-full items-start justify-between gap-3">{content}</div>
    </Card>
  );
};

export default StatCard;
