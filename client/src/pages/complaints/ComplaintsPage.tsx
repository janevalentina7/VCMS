import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Download, FilePlus2, RefreshCw } from 'lucide-react';
import { api, buildQuery } from '@/lib/api';
import { exportCsv, formatNumber } from '@/lib/utils';
import { useAsync, useDebouncedValue } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import Tabs from '@/components/ui/Tabs';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import ComplaintTable from '@/components/complaint/ComplaintTable';
import ComplaintFilters from '@/components/complaint/ComplaintFilters';
import AssignOfficerDialog from '@/components/complaint/AssignOfficerDialog';
import StatusUpdateDialog from '@/components/complaint/StatusUpdateDialog';
import ComplaintEditDialog from '@/components/complaint/ComplaintEditDialog';
import type { Category, ComplaintFilters as Filters, ComplaintSummary, Paginated, Pagination as PaginationMeta, Ward } from '@/types';

interface Officer {
  id: number;
  name: string;
  wardName: string | null;
}

const DEFAULT_FILTERS: Filters = { sort: 'newest', page: 1, pageSize: 10, status: 'all', priority: 'all' };

/**
 * Complaint register with search, filters, sorting, tabbed status views,
 * pagination, CSV export and role-aware actions (§14, §22).
 */
export const ComplaintsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    q: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ?? 'all',
  }));
  const [assignTarget, setAssignTarget] = useState<ComplaintSummary | null>(null);
  const [statusTarget, setStatusTarget] = useState<ComplaintSummary | null>(null);
  const [editTarget, setEditTarget] = useState<ComplaintSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: categories = [] } = useAsync<Category[]>((signal) => api.get<Category[]>('/categories', signal), []);
  const { data: wards = [] } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards', signal), []);
  const { data: officers = [] } = useAsync<Officer[]>(
    (signal) => (user?.role === 'admin' ? api.get<Officer[]>('/users/officers', signal) : Promise.resolve([])),
    [user?.role],
  );

  const query = useMemo(
    () =>
      buildQuery({
        q: filters.q,
        status: filters.status,
        priority: filters.priority,
        categoryId: filters.categoryId,
        wardId: filters.wardId,
        officerId: filters.officerId,
        from: filters.from,
        to: filters.to,
        sort: filters.sort,
        page: filters.page,
        pageSize: filters.pageSize,
      }),
    [filters],
  );

  const { data, loading, error, reload } = useAsync<Paginated<ComplaintSummary>>(
    async (signal) => {
      const result = await api.getWithMeta<ComplaintSummary[]>(`/complaints?${query}`, signal);
      return {
        items: result.data ?? [],
        meta: {
          pagination:
            result.meta?.pagination ?? { page: 1, pageSize: filters.pageSize ?? 10, total: result.data?.length ?? 0, totalPages: 1, hasNext: false, hasPrev: false },
        },
      };
    },
    [query, refreshKey],
    { skip: !user },
  );

  // Keep the URL in sync so complaint searches are shareable / bookmarkable.
  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.q) next.set('q', filters.q);
    if (filters.status && filters.status !== 'all') next.set('status', filters.status);
    if (filters.categoryId) next.set('category', String(filters.categoryId));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.status, filters.categoryId]);

  const patchFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const reset = () => setFilters({ ...DEFAULT_FILTERS });

  const complaints = data?.items ?? [];
  const pagination: PaginationMeta =
    data?.meta.pagination ?? { page: filters.page ?? 1, pageSize: filters.pageSize ?? 10, total: complaints.length, totalPages: 1, hasNext: false, hasPrev: false };

  const statusCounts = useMemo(() => {
    // Lightweight client-side tally of the current page for the tab badges.
    return {
      all: pagination.total,
    };
  }, [pagination.total]);

  const onExport = () => {
    if (!complaints.length) {
      toast.info('Nothing to export', 'No complaints match the current filters.');
      return;
    }
    exportCsv(
      complaints.map((complaint) => ({
        'Complaint ID': complaint.complaintId,
        Citizen: complaint.citizenName,
        'Ration Number': complaint.rationNumber ?? '',
        Mobile: complaint.mobileNumber,
        Category: complaint.categoryName ?? '',
        Location: complaint.location,
        Ward: complaint.wardName ?? '',
        Priority: complaint.priorityLabel,
        Status: complaint.statusLabel,
        'Complaint Date': complaint.complaintDate?.slice(0, 10) ?? '',
        'Resolution Date': complaint.resolutionDate?.slice(0, 10) ?? '',
        'Assigned Officer': complaint.assignedOfficerName ?? '',
      })),
      `VCMS-complaints-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success('Export ready', `${complaints.length} complaint(s) exported as CSV.`);
  };

  const refreshAll = () => {
    reload();
    setRefreshKey((key) => key + 1);
  };

  const role = user?.role ?? 'citizen';

  return (
    <>
      <PageHeader
        title={role === 'officer' ? 'My assigned complaints' : role === 'admin' ? 'All complaints' : 'My complaints'}
        description={
          role === 'admin'
            ? 'Search, filter and manage every grievance registered in the village panchayat.'
            : role === 'officer'
              ? 'Complaints assigned to you. Update the status and add remarks as the work progresses.'
              : 'All grievances you have registered, with their current status and resolution details.'
        }
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={refreshAll} aria-label="Refresh list">
              Refresh
            </Button>
            {role !== 'officer' && (
              <Link to="/complaints/new" className="btn btn-primary">
                <FilePlus2 className="h-4 w-4" aria-hidden /> Register complaint
              </Link>
            )}
          </>
        }
      />

      <ComplaintFilters
        filters={filters}
        onChange={patchFilters}
        onReset={reset}
        categories={categories ?? []}
        wards={wards ?? []}
        officers={officers ?? []}
        showOfficerFilter={role === 'admin'}
        showWardFilter={role !== 'citizen'}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          ariaLabel="Filter by status"
          active={String(filters.status ?? 'all')}
          onChange={(id) => patchFilters({ status: id, page: 1 })}
          tabs={[
            { id: 'all', label: 'All', count: statusCounts.all },
            { id: 'pending', label: 'Pending' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'resolved', label: 'Resolved' },
            { id: 'rejected', label: 'Rejected' },
          ]}
        />

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted sm:inline">
            {formatNumber(pagination.total)} complaint(s)
          </span>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={onExport}>
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      <Card className="mt-4">
        {loading ? (
          <SkeletonTable rows={8} columns={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : complaints.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-7 w-7" />}
            title={filters.q ? `No complaints found for “${filters.q}”` : 'No complaints found'}
            description={
              filters.q || filters.status !== 'all' || filters.priority !== 'all'
                ? 'Try clearing the search or filters to see more results.'
                : role === 'officer'
                  ? 'No complaints have been assigned to you yet. You will be notified as soon as one is assigned.'
                  : 'Report a civic issue such as a broken street light, water leakage or garbage problem to get started.'
            }
            action={
              filters.q || filters.status !== 'all' ? (
                <Button variant="secondary" onClick={reset}>
                  Clear filters
                </Button>
              ) : (
                role !== 'officer' && (
                  <Link to="/complaints/new" className="btn btn-primary">
                    <FilePlus2 className="h-4 w-4" aria-hidden /> Register a complaint
                  </Link>
                )
              )
            }
          />
        ) : (
          <ComplaintTable
            complaints={complaints}
            role={role}
            onAssign={(complaint) => setAssignTarget(complaint)}
            onStatusChange={role === 'officer' || role === 'admin' ? (complaint) => setStatusTarget(complaint) : undefined}
            onEdit={role === 'admin' ? (complaint) => setEditTarget(complaint) : undefined}
            onApprove={
              role === 'admin'
                ? async (complaint) => {
                    try {
                      await api.post(`/complaints/${complaint.id}/approve`, {});
                      toast.success('Complaint approved', `${complaint.complaintId} moved to In Progress.`);
                      refreshAll();
                    } catch (err) {
                      toast.error('Approval failed', err instanceof Error ? err.message : 'Please try again.');
                    }
                  }
                : undefined
            }
          />
        )}

        {!loading && !error && complaints.length > 0 && (
          <Pagination
            meta={pagination}
            onPageChange={(page) => patchFilters({ page })}
            onPageSizeChange={(pageSize) => patchFilters({ pageSize, page: 1 })}
            itemLabel="complaints"
          />
        )}
      </Card>

      <AssignOfficerDialog open={Boolean(assignTarget)} complaint={assignTarget} onClose={() => setAssignTarget(null)} onAssigned={refreshAll} />
      <StatusUpdateDialog open={Boolean(statusTarget)} complaint={statusTarget} onClose={() => setStatusTarget(null)} onUpdated={refreshAll} />
      <ComplaintEditDialog
        open={Boolean(editTarget)}
        complaint={editTarget}
        categories={categories ?? []}
        wards={wards ?? []}
        onClose={() => setEditTarget(null)}
        onSaved={refreshAll}
      />
    </>
  );
};

export default ComplaintsPage;
