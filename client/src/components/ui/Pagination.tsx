import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils';
import type { Pagination as PaginationMeta } from '@/types';
import Button from './Button';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

/** Builds a compact page list with ellipses, e.g. 1 … 4 5 6 … 12 */
const buildPages = (current: number, total: number): (number | 'gap')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('gap');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push('gap');
  pages.push(total);
  return pages;
};

export const Pagination = ({ meta, onPageChange, onPageSizeChange, pageSizeOptions = [10, 25, 50], itemLabel = 'records', className }: PaginationProps) => {
  const { page, pageSize, total, totalPages } = meta;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={cn('flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-xs text-muted">
        Showing <span className="font-semibold text-ink">{formatNumber(from)}</span>–
        <span className="font-semibold text-ink">{formatNumber(to)}</span> of{' '}
        <span className="font-semibold text-ink">{formatNumber(total)}</span> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <label className="mr-1 flex items-center gap-1.5 text-xs text-muted">
            <span className="hidden sm:inline">Rows</span>
            <select
              className="field w-auto px-2 py-1 text-xs"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button variant="secondary" size="sm" onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="First page" className="px-2">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page" className="px-2">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {buildPages(page, totalPages).map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-muted" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={entry}
                variant={entry === page ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                aria-label={`Page ${entry}`}
                className="min-w-[32px] px-2"
              >
                {entry}
              </Button>
            ),
          )}

          <Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page" className="px-2">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} aria-label="Last page" className="px-2">
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </nav>
      </div>
    </div>
  );
};

export default Pagination;
