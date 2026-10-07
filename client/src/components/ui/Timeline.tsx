import { Check, Clock, FileText, MessageSquarePlus, UserPlus, X, Wrench } from 'lucide-react';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { ACTION_LABELS } from '@/lib/constants';
import type { ComplaintHistoryEntry } from '@/types';

const ACTION_ICON = (action: string) => {
  if (action === 'created') return FileText;
  if (action === 'approved') return Check;
  if (action === 'assigned' || action === 'reassigned') return UserPlus;
  if (action === 'status:resolved') return Check;
  if (action === 'status:rejected') return X;
  if (action === 'status:in_progress') return Wrench;
  if (action === 'remark') return MessageSquarePlus;
  return Clock;
};

const TONE = (entry: ComplaintHistoryEntry) => {
  if (entry.newStatus === 'resolved') return 'text-success border-success/40 bg-success-soft';
  if (entry.newStatus === 'rejected') return 'text-danger border-danger/40 bg-danger-soft';
  if (entry.newStatus === 'in_progress') return 'text-info border-info/40 bg-info-soft';
  if (entry.action === 'remark') return 'text-muted border-line bg-elevated';
  return 'text-warning border-warning/40 bg-warning-soft';
};

/** Vertical, timestamped complaint timeline (§12). */
export const ComplaintTimeline = ({ history, className }: { history: ComplaintHistoryEntry[]; className?: string }) => {
  if (!history?.length) {
    return <p className="text-sm text-muted">No history recorded yet for this complaint.</p>;
  }

  return (
    <ol className={cn('relative space-y-4 pl-1', className)}>
      {history.map((entry, index) => {
        const Icon = ACTION_ICON(entry.action);
        const isLast = index === history.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3.5">
            {!isLast && <span className="absolute left-[15px] top-9 h-[calc(100%-4px)] w-px bg-line" aria-hidden />}
            <span className={cn('z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border', TONE(entry))}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-sm font-semibold text-ink">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                {entry.newStatus && entry.oldStatus && entry.oldStatus !== entry.newStatus && (
                  <span className="text-2xs text-muted">
                    {entry.oldStatus.replace('_', ' ')} → <span className="font-medium text-ink">{entry.newStatus.replace('_', ' ')}</span>
                  </span>
                )}
              </div>
              {entry.remarks && <p className="mt-1 text-sm text-muted">{entry.remarks}</p>}
              <p className="mt-1 text-2xs text-muted">
                {formatDateTime(entry.timestamp)}
                {entry.changedByName ? ` • ${entry.changedByName}` : ''}
                {entry.changedByRole ? ` (${entry.changedByRole})` : ''}
                <span className="mx-1.5 text-line">|</span>
                <span title={entry.timestamp}>{formatRelative(entry.timestamp)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default ComplaintTimeline;
