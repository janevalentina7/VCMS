import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { api, buildQuery } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks';
import { StatusBadge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import type { ComplaintSummary, Paginated } from '@/types';

/** Top-bar complaint search (complaint id, citizen, ration number, mobile, location). */
export const GlobalSearch = ({ compact = false }: { compact?: boolean }) => {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ComplaintSummary[]>([]);
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebouncedValue(term, 320);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!user || debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    api
      .getWithMeta<ComplaintSummary[]>(`/complaints?${buildQuery({ q: debounced.trim(), pageSize: 6 })}`, controller.signal)
      .then((response) => {
        setResults(response.data ?? []);
        setHighlight(0);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [debounced, user]);

  const hint = useMemo(() => (user ? 'Search complaint ID, citizen, ration no., mobile…' : 'Sign in to search complaints'), [user]);

  const go = (complaint: ComplaintSummary) => {
    setOpen(false);
    setTerm('');
    navigate(`/complaints/${complaint.id}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={term}
          disabled={!user}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => term.length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={hint}
          aria-label="Search complaints"
          className={cn('field pl-9 pr-9', compact && 'py-2 text-xs')}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-hidden />
        ) : (
          term && (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                setOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>

      {open && term.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 animate-fade-in-up overflow-hidden rounded-xl border border-line bg-surface shadow-raised">
          {loading && !results.length ? (
            <p className="px-4 py-3 text-xs text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted">No complaints matched “{term}”.</p>
          ) : (
            <ul className="max-h-[320px] divide-y divide-line/70 overflow-y-auto">
              {results.map((complaint, index) => (
                <li key={complaint.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => go(complaint)}
                    className={cn('flex w-full flex-col gap-1 px-3.5 py-2.5 text-left transition-colors', index === highlight ? 'bg-primary-soft/60' : 'hover:bg-elevated')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-2xs font-semibold text-primary">{complaint.complaintId}</span>
                      <StatusBadge status={complaint.status} label={complaint.statusLabel} />
                    </span>
                    <span className="truncate text-xs font-medium text-ink">
                      {complaint.categoryName} • {complaint.location}
                    </span>
                    <span className="truncate text-2xs text-muted">
                      {complaint.citizenName} • {formatDate(complaint.complaintDate)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(`/complaints?q=${encodeURIComponent(term.trim())}`);
              setTerm('');
            }}
            className="w-full border-t border-line px-3 py-2.5 text-center text-xs font-semibold text-primary transition-colors hover:bg-primary-soft"
          >
            View all results for “{term}”
          </button>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
