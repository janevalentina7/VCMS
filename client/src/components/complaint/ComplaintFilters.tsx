import { useEffect, useState } from 'react';
import { Filter, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { api, buildQuery } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PRIORITY_OPTIONS, SORT_OPTIONS, STATUS_OPTIONS, categoryIcon } from '@/lib/constants';
import { useDebouncedValue } from '@/hooks';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import type { Category, ComplaintFilters as Filters, Ward } from '@/types';

export interface OfficerOptionType {
  id: number;
  name: string;
  wardName?: string | null;
  activeAssignments?: number;
}

interface ComplaintFiltersProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  categories: Category[];
  wards: Ward[];
  officers?: OfficerOptionType[];
  showOfficerFilter?: boolean;
  showWardFilter?: boolean;
  className?: string;
}

/** Search + advanced filter bar used by the complaint register (§22). */
export const ComplaintFilters = ({
  filters,
  onChange,
  onReset,
  categories,
  wards,
  officers = [],
  showOfficerFilter = false,
  showWardFilter = true,
  className,
}: ComplaintFiltersProps) => {
  const [term, setTerm] = useState(filters.q ?? '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const debounced = useDebouncedValue(term, 400);

  useEffect(() => {
    if ((filters.q ?? '') !== debounced) onChange({ q: debounced, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const activeCount = [
    filters.status && filters.status !== 'all',
    filters.priority && filters.priority !== 'all',
    filters.categoryId,
    filters.wardId,
    filters.officerId,
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  return (
    <div className={cn('card card-pad', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Input
            label="Search complaints"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Complaint ID, citizen name, ration number, mobile, category or location"
            icon={<Search className="h-4 w-4" />}
            aria-label="Search complaints"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-3">
          <Select
            label="Status"
            value={filters.status ?? 'all'}
            onChange={(event) => onChange({ status: event.target.value, page: 1 })}
            options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            containerClassName="min-w-[140px]"
          />
          <Select
            label="Priority"
            value={filters.priority ?? 'all'}
            onChange={(event) => onChange({ priority: event.target.value, page: 1 })}
            options={PRIORITY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            containerClassName="min-w-[140px]"
          />
          <Select
            label="Sort by"
            value={filters.sort ?? 'newest'}
            onChange={(event) => onChange({ sort: event.target.value as Filters['sort'], page: 1 })}
            options={SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            containerClassName="col-span-2 min-w-[150px] sm:col-span-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={() => setShowAdvanced((open) => !open)}
            aria-expanded={showAdvanced}
            aria-controls="complaint-advanced-filters"
            className="flex-1 lg:flex-none"
          >
            Filters
            {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-2xs font-bold text-primary-fg">{activeCount}</span>}
          </Button>
          <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setTerm(''); onReset(); }}>
            Reset
          </Button>
        </div>
      </div>

      {showAdvanced && (
        <div id="complaint-advanced-filters" className="mt-4 grid animate-fade-in gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Select
            label="Category"
            value={filters.categoryId ?? ''}
            onChange={(event) => onChange({ categoryId: event.target.value || undefined, page: 1 })}
            placeholder="All categories"
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
          />

          {showWardFilter && (
            <Select
              label="Ward"
              value={filters.wardId ?? ''}
              onChange={(event) => onChange({ wardId: event.target.value || undefined, page: 1 })}
              placeholder="All wards"
              options={wards.map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` }))}
            />
          )}

          {showOfficerFilter && (
            <Select
              label="Assigned officer"
              value={filters.officerId ?? ''}
              onChange={(event) => onChange({ officerId: event.target.value || undefined, page: 1 })}
              placeholder="All officers"
              options={officers.map((officer) => ({
                value: officer.id,
                label: `${officer.name}${officer.wardName ? ` — ${officer.wardName}` : ''}`,
              }))}
            />
          )}

          <Input
            type="date"
            label="From date"
            value={filters.from ?? ''}
            max={filters.to ?? undefined}
            onChange={(event) => onChange({ from: event.target.value || undefined, page: 1 })}
          />
          <Input
            type="date"
            label="To date"
            value={filters.to ?? ''}
            min={filters.from ?? undefined}
            onChange={(event) => onChange({ to: event.target.value || undefined, page: 1 })}
          />
        </div>
      )}

      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted">
            <Filter className="h-3 w-3" aria-hidden /> Active filters
          </span>
          {filters.status && filters.status !== 'all' && (
            <button type="button" onClick={() => onChange({ status: 'all' })} className="badge border-primary/30 bg-primary-soft text-primary">
              {STATUS_OPTIONS.find((option) => option.value === filters.status)?.label}
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
          {filters.priority && filters.priority !== 'all' && (
            <button type="button" onClick={() => onChange({ priority: 'all' })} className="badge border-primary/30 bg-primary-soft text-primary">
              {PRIORITY_OPTIONS.find((option) => option.value === filters.priority)?.label}
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
          {filters.categoryId && (
            <button type="button" onClick={() => onChange({ categoryId: undefined })} className="badge border-primary/30 bg-primary-soft text-primary">
              {categories.find((category) => String(category.id) === String(filters.categoryId))?.name ?? 'Category'}
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
          {filters.wardId && (
            <button type="button" onClick={() => onChange({ wardId: undefined })} className="badge border-primary/30 bg-primary-soft text-primary">
              {wards.find((ward) => String(ward.id) === String(filters.wardId))?.name ?? 'Ward'}
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
          {filters.officerId && (
            <button type="button" onClick={() => onChange({ officerId: undefined })} className="badge border-primary/30 bg-primary-soft text-primary">
              {officers.find((officer) => String(officer.id) === String(filters.officerId))?.name ?? 'Officer'}
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
          {(filters.from || filters.to) && (
            <button type="button" onClick={() => onChange({ from: undefined, to: undefined })} className="badge border-primary/30 bg-primary-soft text-primary">
              {filters.from ?? 'Any'} → {filters.to ?? 'Any'}
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ComplaintFilters;
