import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div className={cn('skeleton h-4 w-full', className)} style={style} aria-hidden />
);

export const SkeletonText = ({ lines = 3, className }: { lines?: number; className?: string }) => (
  <div className={cn('space-y-2', className)} aria-hidden>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton key={index} className={index === lines - 1 ? 'w-3/5' : index % 2 ? 'w-11/12' : 'w-full'} />
    ))}
  </div>
);

export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('card card-pad', className)} aria-hidden>
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-live="polite">
    <div className="hidden gap-3 sm:flex" aria-hidden>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} className="h-3 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex flex-wrap items-center gap-3 border-b border-line/60 pb-3" aria-hidden>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} className={cn('h-4 flex-1', colIndex === 0 && 'max-w-[140px]')} />
        ))}
      </div>
    ))}
    <span className="sr-only">Loading results…</span>
  </div>
);

export const SkeletonChart = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div className={cn('flex h-64 items-end gap-3', className)} style={style} aria-hidden>
    {[45, 70, 35, 90, 60, 78, 40, 84, 55, 68, 30, 74].map((height, index) => (
      <Skeleton key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%` }} />
    ))}
  </div>
);

export default Skeleton;
