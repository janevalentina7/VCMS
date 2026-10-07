import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePlus2,
  Gauge,
  MapPin,
  ShieldCheck,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, formatNumber, formatPercent, truncate } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { CATEGORY_FALLBACK, PRIORITY_META, categoryIcon } from '@/lib/constants';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge, PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import StatCard from '@/components/dashboard/StatCard';
import ChartCard from '@/components/charts/ChartCard';
import { CategoryBarChart, MonthlyLineChart, PriorityBarChart, StatusDonutChart, WardBarChart } from '@/components/charts/Charts';
import ComplaintTable from '@/components/complaint/ComplaintTable';
import AssignOfficerDialog from '@/components/complaint/AssignOfficerDialog';
import StatusUpdateDialog from '@/components/complaint/StatusUpdateDialog';
import PageHeader from '@/components/layout/PageHeader';
import type {
  AnalyticsDashboard,
  ComplaintSummary,
  OfficerSummary,
  Paginated,
  User,
} from '@/types';

const useDashboardData = (path: string) => useAsync<AnalyticsDashboard>((signal) => api.get<AnalyticsDashboard>(path, signal), [path]);

/** ── Recent complaints panel (§7) ─────────────────────────────────────── */
const RecentComplaints = ({ limit = 6, recentOnly = true }: { limit?: number; recentOnly?: boolean }) => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [assignTarget, setAssignTarget] = useState<ComplaintSummary | null>(null);
  const [statusTarget, setStatusTarget] = useState<ComplaintSummary | null>(null);
  const toast = useToast();

  const { data, loading, error, reload } = useAsync<Paginated<ComplaintSummary>>(
    async (signal) => {
      const result = await api.getWithMeta<ComplaintSummary[]>(`/complaints?pageSize=${limit}&sort=newest`, signal);
      return { items: result.data ?? [], meta: { pagination: result.meta?.pagination ?? { page: 1, pageSize: limit, total: 0, totalPages: 1, hasNext: false, hasPrev: false } } };
    },
    [limit, refreshKey],
  );

  const onChanged = () => {
    setRefreshKey((key) => key + 1);
    reload();
  };

  const complaints = data?.items ?? [];

  return (
    <Card>
      <CardHeader
        icon={<ClipboardList className="h-4 w-4" aria-hidden />}
        title={recentOnly ? 'Recent complaints' : 'Complaint register'}
        subtitle="Latest grievances registered in the village"
        action={
          <Link to="/complaints" className="btn btn-secondary btn-sm">
            View all
          </Link>
        }
      />

      {loading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : complaints.length === 0 ? (
        <EmptyState
          title="No complaints registered yet"
          description="As soon as citizens start reporting issues, they will appear here with their status and assigned officer."
          action={
            user?.role !== 'officer' && (
              <Link to="/complaints/new" className="btn btn-primary">
                <FilePlus2 className="h-4 w-4" aria-hidden /> Register a complaint
              </Link>
            )
          }
        />
      ) : (
        <ComplaintTable
          complaints={complaints}
          role={user?.role ?? 'citizen'}
          onAssign={(complaint) => setAssignTarget(complaint)}
          onStatusChange={user?.role === 'admin' ? undefined : (complaint) => setStatusTarget(complaint)}
          onApprove={
            user?.role === 'admin'
              ? async (complaint) => {
                  try {
                    await api.post(`/complaints/${complaint.id}/approve`, {});
                    toast.success('Complaint approved', `${complaint.complaintId} moved to In Progress.`);
                    onChanged();
                  } catch (err) {
                    toast.error('Approval failed', err instanceof Error ? err.message : 'Please try again.');
                  }
                }
              : undefined
          }
        />
      )}

      <AssignOfficerDialog open={Boolean(assignTarget)} complaint={assignTarget} onClose={() => setAssignTarget(null)} onAssigned={onChanged} />
      <StatusUpdateDialog open={Boolean(statusTarget)} complaint={statusTarget} onClose={() => setStatusTarget(null)} onUpdated={onChanged} />
    </Card>
  );
};

/** ── Administrator dashboard ──────────────────────────────────────────── */
const AdminDashboard = () => {
  const { data, loading, error, reload } = useDashboardData('/analytics/dashboard');
  const { data: users } = useAsync<{ byRole: { citizen: number; officer: number; admin: number; total: number; active: number } }>(
    (signal) => api.get('/users/stats', signal),
    [],
  );
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const monthly = useMemo(() => data?.charts.monthly, [data]);
  const kpis = data?.kpis;

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={reload} />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Administrator dashboard"
        description="Village-wide complaint position, officer workload and resolution performance at a glance."
        actions={
          <>
            <Link to="/complaints/new" className="btn btn-secondary">
              <FilePlus2 className="h-4 w-4" aria-hidden /> Register complaint
            </Link>
            <Link to="/reports" className="btn btn-primary">
              <BarChart3 className="h-4 w-4" aria-hidden /> Reports & analytics
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard loading={loading} label="Total complaints" value={kpis?.total ?? 0} trend={kpis?.monthlyGrowth ?? null} icon={<ClipboardList className="h-5 w-5" aria-hidden />} tone="primary" onClick={() => undefined} />
        <StatCard loading={loading} label="Pending" value={kpis?.pending ?? 0} hint={`${formatPercent(kpis?.pendingRate ?? 0)} of all complaints`} icon={<Clock className="h-5 w-5" aria-hidden />} tone="warning" />
        <StatCard loading={loading} label="In progress" value={kpis?.in_progress ?? 0} hint="Being investigated by officers" icon={<Wrench className="h-5 w-5" aria-hidden />} tone="info" />
        <StatCard loading={loading} label="Resolved" value={kpis?.resolved ?? 0} hint={`Resolution rate ${formatPercent(kpis?.resolutionRate ?? 0)}`} icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} tone="success" />
        <StatCard loading={loading} label="Rejected" value={kpis?.rejected ?? 0} hint={`${formatPercent(kpis?.rejectionRate ?? 0)} of all complaints`} icon={<XCircle className="h-5 w-5" aria-hidden />} tone="danger" />
        <StatCard loading={loading} label="Registered citizens" value={users?.byRole?.citizen ?? 0} hint="Citizen accounts on the portal" icon={<Users className="h-5 w-5" aria-hidden />} tone="neutral" />
        <StatCard loading={loading} label="Village officers" value={users?.byRole?.officer ?? 0} hint="Active field officers" icon={<UserCog className="h-5 w-5" aria-hidden />} tone="primary" />
        <StatCard
          loading={loading}
          label="Average resolution time"
          value={`${kpis?.averageResolutionDays ?? 0} d`}
          hint={`${formatNumber(kpis?.resolvedCount ?? 0)} complaints resolved so far`}
          icon={<Gauge className="h-5 w-5" aria-hidden />}
          tone="neutral"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Monthly complaint statistics"
          subtitle="Registered versus resolved complaints"
          loading={loading}
          empty={!monthly?.series?.length}
          action={
            <select
              className="field w-auto px-2 py-1 text-xs"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              aria-label="Select year"
            >
              {(monthly?.years ?? [new Date().getFullYear()]).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          }
        >
          <MonthlyLineChart data={monthly?.series ?? []} />
        </ChartCard>

        <ChartCard title="Resolved vs pending" subtitle="Current complaint status split" loading={loading} empty={!data?.charts.statuses?.length}>
          <StatusDonutChart data={data?.charts.statuses ?? []} />
        </ChartCard>

        <ChartCard className="xl:col-span-2" title="Complaints by category" subtitle="Distribution across civic categories" loading={loading} empty={!data?.charts.categories?.length}>
          <CategoryBarChart data={data?.charts.categories ?? []} />
        </ChartCard>

        <ChartCard title="Priority distribution" subtitle="Urgency of registered complaints" loading={loading} empty={!data?.charts.priorities?.length}>
          <PriorityBarChart data={data?.charts.priorities ?? []} />
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentComplaints limit={7} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={<TrendingUp className="h-4 w-4" aria-hidden />}
              title="Key performance indicators"
              subtitle="Computed live from the complaint register"
            />
            <dl className="space-y-3.5">
              {[
                ['Resolution rate', `${formatPercent(kpis?.resolutionRate ?? 0)}`, kpis?.resolutionRate ?? 0, 'bg-success'],
                ['Pending rate', `${formatPercent(kpis?.pendingRate ?? 0)}`, kpis?.pendingRate ?? 0, 'bg-warning'],
                ['In progress rate', `${formatPercent(kpis?.inProgressRate ?? 0)}`, kpis?.inProgressRate ?? 0, 'bg-info'],
                ['Rejection rate', `${formatPercent(kpis?.rejectionRate ?? 0)}`, kpis?.rejectionRate ?? 0, 'bg-danger'],
              ].map(([label, value, percent, colour]) => (
                <div key={String(label)}>
                  <div className="flex items-center justify-between text-xs">
                    <dt className="font-medium text-muted">{label}</dt>
                    <dd className="font-semibold text-ink">{value}</dd>
                  </div>
                  <ProgressBar className="mt-1.5" value={Number(percent)} colour={undefined} />
                </div>
              ))}
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Most common category</p>
                <p className="mt-0.5 font-semibold text-ink">{kpis?.mostCommonCategory?.name ?? '—'}</p>
                <p className="text-2xs text-muted">{kpis?.mostCommonCategory ? `${kpis.mostCommonCategory.count} complaints` : 'No data yet'}</p>
              </div>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Highest complaint ward</p>
                <p className="mt-0.5 font-semibold text-ink">{kpis?.highestComplaintWard?.name?.replace(/ —.*/, '') ?? '—'}</p>
                <p className="text-2xs text-muted">{kpis?.highestComplaintWard ? `${kpis.highestComplaintWard.count} complaints` : 'No data yet'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader icon={<MapPin className="h-4 w-4" aria-hidden />} title="Ward-wise distribution" subtitle="Complaint load per ward" />
            {loading ? <SkeletonCard /> : <div className="h-56"><WardBarChart data={data?.charts.wards ?? []} /></div>}
          </Card>
        </div>
      </div>
    </>
  );
};

/** ── Village officer dashboard (§16) ──────────────────────────────────── */
const OfficerDashboard = () => {
  const { user } = useAuth();
  const { data: summary, loading, error, reload } = useAsync<OfficerSummary>((signal) => api.get<OfficerSummary>('/analytics/officer-summary', signal), []);
  const [statusTarget, setStatusTarget] = useState<ComplaintSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const toast = useToast();

  const { data, loading: listLoading, reload: reloadList } = useAsync<Paginated<ComplaintSummary>>(
    async (signal) => {
      const result = await api.getWithMeta<ComplaintSummary[]>('/complaints?pageSize=8&sort=priority', signal);
      return {
        items: result.data ?? [],
        meta: { pagination: result.meta?.pagination ?? { page: 1, pageSize: 8, total: result.data?.length ?? 0, totalPages: 1, hasNext: false, hasPrev: false } },
      };
    },
    [refreshKey],
  );

  const refreshAll = () => {
    reload();
    reloadList();
    setRefreshKey((key) => key + 1);
  };

  const highPriority = (data?.items ?? []).filter((complaint) => complaint.priority === 'high' || complaint.priority === 'critical');

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] ?? 'Officer'}`}
        description={`Your complaint worklist${user?.wardName ? ` for ${user.wardName}` : ''}. Prioritise high priority and ageing complaints.`}
        actions={
          <Link to="/complaints" className="btn btn-secondary">
            <ClipboardList className="h-4 w-4" aria-hidden /> All my complaints
          </Link>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard loading={loading} label="Assigned to me" value={summary?.assigned ?? 0} hint="All complaints assigned" icon={<ClipboardList className="h-5 w-5" aria-hidden />} tone="primary" />
            <StatCard loading={loading} label="Pending" value={summary?.pending ?? 0} hint="Awaiting first action" icon={<Clock className="h-5 w-5" aria-hidden />} tone="warning" />
            <StatCard loading={loading} label="In progress" value={summary?.inProgress ?? 0} hint="Under investigation" icon={<Wrench className="h-5 w-5" aria-hidden />} tone="info" />
            <StatCard loading={loading} label="Resolved" value={summary?.resolved ?? 0} hint={`Resolution rate ${formatPercent(summary?.resolutionRate ?? 0)}`} icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} tone="success" />
            <StatCard loading={loading} label="High priority" value={summary?.highPriority ?? 0} hint={summary?.overdue ? `${summary.overdue} ageing over 7 days` : 'No ageing complaints'} icon={<AlertTriangle className="h-5 w-5" aria-hidden />} tone="danger" />
          </div>

          {highPriority.length > 0 && (
            <Card className="mt-5 border-warning/40 bg-warning-soft/40">
              <CardHeader
                icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
                title="Action required — high priority complaints"
                subtitle="These complaints need attention first"
              />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {highPriority.slice(0, 3).map((complaint) => (
                  <li key={complaint.id} className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/complaints/${complaint.id}`} className="font-mono text-2xs font-bold text-primary">
                        {complaint.complaintId}
                      </Link>
                      <PriorityBadge priority={complaint.priority} label={complaint.priorityLabel} />
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink">{complaint.categoryName}</p>
                    <p className="text-2xs text-muted">{complaint.location}</p>
                    <Button variant="secondary" size="sm" className="mt-2.5 w-full justify-center" onClick={() => setStatusTarget(complaint)}>
                      Update status
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Card>
                <CardHeader
                  icon={<Activity className="h-4 w-4" aria-hidden />}
                  title="My assigned complaints"
                  subtitle="Sorted by priority — highest first"
                  action={
                    <Link to="/complaints" className="btn btn-secondary btn-sm">
                      View all
                    </Link>
                  }
                />
                {listLoading ? (
                  <SkeletonTable rows={5} columns={4} />
                ) : (data?.items ?? []).length === 0 ? (
                  <EmptyState title="No assigned complaints" description="You currently have no complaints assigned to you. New assignments will appear here with a notification." />
                ) : (
                  <ComplaintTable complaints={data?.items ?? []} role="officer" onStatusChange={(complaint) => setStatusTarget(complaint)} />
                )}
              </Card>
            </div>

            <div className="space-y-5">
              <Card>
                <CardHeader icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title="Resolution performance" subtitle="Based on all complaints assigned to you" />
                <ProgressBar value={summary?.resolutionRate ?? 0} label="Resolution rate" showValue />
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-line bg-elevated/60 p-3">
                    <dt className="text-2xs uppercase tracking-wide text-muted">Average resolution</dt>
                    <dd className="mt-0.5 text-lg font-bold text-ink">{summary?.averageResolutionDays ?? 0} days</dd>
                  </div>
                  <div className="rounded-lg border border-line bg-elevated/60 p-3">
                    <dt className="text-2xs uppercase tracking-wide text-muted">This month</dt>
                    <dd className="mt-0.5 text-lg font-bold text-ink">{summary?.thisMonth ?? 0}</dd>
                  </div>
                </dl>
              </Card>

              <Card>
                <CardHeader icon={<MapPin className="h-4 w-4" aria-hidden />} title="Recent complaints in my list" subtitle="Latest 5 entries" />
                <ul className="space-y-2.5">
                  {(data?.items ?? []).slice(0, 5).map((complaint) => {
                    const Icon = categoryIcon(complaint.categoryIcon);
                    return (
                      <li key={complaint.id} className="flex items-start gap-2.5 rounded-lg border border-line p-2.5">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: complaint.categoryColour ?? undefined }} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <Link to={`/complaints/${complaint.id}`} className="block truncate text-xs font-semibold text-primary">
                            {complaint.complaintId}
                          </Link>
                          <p className="truncate text-2xs text-muted">{truncate(complaint.description, 60)}</p>
                        </div>
                        <StatusBadge status={complaint.status} label={complaint.statusLabel} />
                      </li>
                    );
                  })}
                  {(data?.items ?? []).length === 0 && <li className="text-xs text-muted">No complaints assigned yet.</li>}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}

      <StatusUpdateDialog
        open={Boolean(statusTarget)}
        complaint={statusTarget}
        onClose={() => setStatusTarget(null)}
        onUpdated={() => {
          refreshAll();
          toast.success('Worklist updated', 'The citizen has been notified of the status change.');
        }}
      />
    </>
  );
};

/** ── Citizen dashboard ────────────────────────────────────────────────── */
const CitizenDashboard = () => {
  const { user } = useAuth();
  const { data, loading, error, reload } = useDashboardData('/analytics/dashboard');
  const { data: recent, loading: recentLoading } = useAsync<Paginated<ComplaintSummary>>(
    async (signal) => {
      const result = await api.getWithMeta<ComplaintSummary[]>('/complaints?pageSize=5&sort=newest', signal);
      return { items: result.data ?? [], meta: { pagination: result.meta?.pagination ?? { page: 1, pageSize: 5, total: 0, totalPages: 1, hasNext: false, hasPrev: false } } };
    },
    [],
  );

  const kpis = data?.kpis;

  return (
    <>
      <PageHeader
        title={`Namaskaram, ${user?.name?.split(' ')[0] ?? 'Citizen'}`}
        description="Register a new grievance, follow the progress of your existing complaints and review resolution remarks."
        actions={
          <>
            <Link to="/track" className="btn btn-secondary">
              <Activity className="h-4 w-4" aria-hidden /> Track by ID
            </Link>
            <Link to="/complaints/new" className="btn btn-primary">
              <FilePlus2 className="h-4 w-4" aria-hidden /> Register complaint
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard loading={loading} label="My complaints" value={kpis?.total ?? 0} trend={kpis?.monthlyGrowth ?? null} icon={<ClipboardList className="h-5 w-5" aria-hidden />} tone="primary" />
        <StatCard loading={loading} label="Pending" value={kpis?.pending ?? 0} hint="Awaiting review or assignment" icon={<Clock className="h-5 w-5" aria-hidden />} tone="warning" />
        <StatCard loading={loading} label="In progress" value={kpis?.in_progress ?? 0} hint="Officer is working on it" icon={<Wrench className="h-5 w-5" aria-hidden />} tone="info" />
        <StatCard loading={loading} label="Resolved" value={kpis?.resolved ?? 0} hint="Closed with resolution remarks" icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} tone="success" />
      </div>

      {error && (
        <Card className="mt-5">
          <ErrorState message={error} onRetry={reload} />
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader
              icon={<ClipboardList className="h-4 w-4" aria-hidden />}
              title="My recent complaints"
              subtitle="Your latest five grievances with live status"
              action={
                <Link to="/complaints" className="btn btn-secondary btn-sm">
                  View all
                </Link>
              }
            />
            {recentLoading ? (
              <SkeletonTable rows={4} columns={4} />
            ) : (recent?.items ?? []).length === 0 ? (
              <EmptyState
                title="No complaints registered yet"
                description="Report a civic issue such as a broken street light, water leakage or garbage collection problem — it takes about two minutes."
                action={
                  <Link to="/complaints/new" className="btn btn-primary">
                    <FilePlus2 className="h-4 w-4" aria-hidden /> Register your first complaint
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {(recent?.items ?? []).map((complaint) => {
                  const Icon = categoryIcon(complaint.categoryIcon);
                  return (
                    <li key={complaint.id} className="rounded-xl border border-line p-3.5 transition-colors hover:border-primary/40">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: complaint.categoryColour ?? undefined }} aria-hidden />
                          <Link to={`/complaints/${complaint.id}`} className="font-mono text-xs font-bold text-primary">
                            {complaint.complaintId}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={complaint.priority} label={complaint.priorityLabel} />
                          <StatusBadge status={complaint.status} label={complaint.statusLabel} />
                        </div>
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink">{complaint.categoryName}</p>
                      <p className="mt-0.5 text-xs text-muted">{truncate(complaint.description, 130)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden /> {complaint.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden /> Registered {formatDate(complaint.complaintDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserCog className="h-3 w-3" aria-hidden /> {complaint.assignedOfficerName ?? 'Officer not assigned yet'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={<BarChart3 className="h-4 w-4" aria-hidden />} title="My complaint status" subtitle="Snapshot of everything you reported" />
            {loading ? <SkeletonCard /> : <div className="h-56"><StatusDonutChart data={data?.charts.statuses ?? []} /></div>}
          </Card>

          <Card>
            <CardHeader icon={<FilePlus2 className="h-4 w-4" aria-hidden />} title="Report a new issue" subtitle="Popular categories" />
            <ul className="grid gap-2">
              {CATEGORY_FALLBACK.slice(0, 5).map((category) => {
                const Icon = categoryIcon(category.icon);
                return (
                  <li key={category.slug}>
                    <Link
                      to={`/complaints/new?category=${category.slug}`}
                      className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-primary-soft/50"
                    >
                      <Icon className="h-4 w-4" style={{ color: category.colour }} aria-hidden />
                      <span className="flex-1 font-medium text-ink">{category.name}</span>
                      <UserPlus className="h-3.5 w-3.5 text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title="Good to know" subtitle="How your grievance is processed" />
            <ol className="space-y-2.5 text-xs text-muted">
              {[
                'Your complaint gets a unique reference number instantly.',
                'The administrator verifies and approves it.',
                'A village officer is assigned and starts the investigation.',
                'You receive a notification when the issue is resolved, along with the officer’s remarks.',
              ].map((text, index) => (
                <li key={text} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-2xs font-bold text-primary">
                    {index + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
};

export const DashboardPage = () => {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'officer') return <OfficerDashboard />;
  return <CitizenDashboard />;
};

export default DashboardPage;
