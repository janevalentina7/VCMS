import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  colour?: string;
  label?: string;
  showValue?: boolean;
}

export const ProgressBar = ({ value, max = 100, className, colour, label, showValue }: ProgressBarProps) => {
  const percent = Math.min(100, Math.max(0, (value / (max || 1)) * 100));
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between text-2xs text-muted">
          {label && <span>{label}</span>}
          {showValue && <span className="font-semibold text-ink">{percent.toFixed(1)}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-line/70"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-smooth"
          style={{ width: `${percent}%`, backgroundColor: colour ?? 'rgb(var(--vcms-primary))' }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
