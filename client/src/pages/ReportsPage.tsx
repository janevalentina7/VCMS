import { useMemo, useState } from 'react';
import { BarChart3, Download, FileText, Filter, Gauge, Printer, RefreshCw, TrendingUp, Trophy, Users } from 'lucide-react';
import { api, buildQuery } from '@/lib/api';
import { exportCsv, formatDate, formatNumber, formatPercent } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '@/lib/constants';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Badge, StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import StatCard from '@/components/dashboard/StatCard';
import ChartCard from '@/components/charts/ChartCard';
import { CategoryBarChart, MonthlyLineChart, StatusDonutChart, WardBarChart } from '@/components/charts/Charts';
import PageHeader from '@/components/layout/PageHeader';
import Logo from '@/components/layout/Logo';
import type { AnalyticsDashboard, Category, ReportPayload, Ward } from '@/types';

interface ReportFilters {
  from: string;
  to: string;
  categoryId: string;
  wardId: string;
  officerId: string;
  status: string;
  priority: string;
}

const EMPTY_FILTERS: ReportFilters = { from: '', to: '', categoryId: '', wardId: '', officerId: '', status: 'all', priority: 'all' };

/**
 * Reports & analytics (§18, §19, §20):
 *  - live KPI cards and interactive charts scoped to the caller's role
 *  - a report builder with the full filter set
 *  - on-screen preview with government heading + summary + complaint table
 *  - PDF export generated server side, plus CSV export
 */
export const ReportsPage = () => {
  const { user, branding } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [year, setYear] = useState(new Date().getFullYear());
  const [generated, setGenerated] = useState<ReportPayload | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: categories = [] } = useAsync<Category[]>((signal) => api.get<Category[]>('/categories', signal), []);
  const { data: wards = [] } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards', signal), []);
  const { data: officers = [] } = useAsync<{ id: number; name: string }[]>(
    (signal) => (isAdmin ? api.get<{ id: number; name: string }[]>('/users/officers', signal) : Promise.resolve([])),
    [isAdmin],
  );

  const analyticsQuery = buildQuery({ year, from: filters.from, to: filters.to, categoryId: filters.categoryId, wardId: filters.wardId });
  const { data: analytics, loading, error, reload } = useAsync<AnalyticsDashboard>(
    (signal) => api.get<AnalyticsDashboard>(`/analytics/dashboard?${analyticsQuery}`, signal),
    [analyticsQuery],
  );

  const kpis = analytics?.kpis;
  const charts = analytics?.charts;

  const reportQuery = useMemo(
    () =>
      buildQuery({
        from: filters.from,
        to: filters.to,
        categoryId: filters.categoryId,
        wardId: filters.wardId,
        officerId: filters.officerId,
        status: filters.status,
        priority: filters.priority,
      }),
    [filters],
  );

  const setFilter = (patch: Partial<ReportFilters>) => setFilters((current) => ({ ...current, ...patch }));

  const generate = async () => {
    setGenerating(true);
    try {
      const report = await api.get<ReportPayload>(`/reports?${reportQuery}`);
      setGenerated(report);
      toast.success('Report generated', `${report.summary.total} complaint(s) included in the report.`);
    } catch (err) {
      toast.error('Report generation failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      await api.download(`/reports/pdf?${reportQuery}`, `VCMS-Complaint-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exported', 'The report PDF has been downloaded.');
    } catch (err) {
      toast.error('PDF export failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportReportCsv = () => {
    const rows = generated?.complaints ?? [];
    if (!rows.length) {
      toast.info('Nothing to export', 'Generate a report with matching complaints first.');
      return;
    }
    exportCsv(
      rows.map((row) => ({
        'Complaint ID': row.complaintId,
        Citizen: row.citizenName,
        Category: row.category,
        Ward: row.ward ?? '',
        Location: row.location,
        Priority: row.priority,
        Status: row.statusLabel,
        Officer: row.officer ?? '',
        'Complaint Date': row.complaintDate?.slice(0, 10) ?? '',
        'Resolution Date': row.resolutionDate?.slice(0, 10) ?? '',
      })),
      `VCMS-report-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success('CSV exported', `${rows.length} row(s) exported.`);
  };

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
        title="Reports & analytics"
        description={
          isAdmin
            ? 'Live village-wide insights, ward performance and printable reports for administrative review.'
            : 'Insights based on the complaints visible to your account.'
        }
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={reload}>
              Refresh
            </Button>
            {isAdmin && (
              <>
                <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportReportCsv}>
                  Export CSV
                </Button>
                <Button variant="primary" icon={<FileText className="h-4 w-4" />} loading={exporting} onClick={exportPdf}>
                  Export PDF
                </Button>
              </>
            )}
          </>
        }
      />

      {/* ── KPI cards (§19) ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard loading={loading} label="Total complaints" value={kpis?.total ?? 0} trend={kpis?.monthlyGrowth ?? null} icon={<BarChart3 className="h-5 w-5" aria-hidden />} tone="primary" />
        <StatCard loading={loading} label="Resolution rate" value={formatPercent(kpis?.resolutionRate ?? 0)} hint={`${formatNumber(kpis?.resolved ?? 0)} resolved`} icon={<TrendingUp className="h-5 w-5" aria-hidden />} tone="success" />
        <StatCard loading={loading} label="Average resolution time" value={`${kpis?.averageResolutionDays ?? 0} days`} hint="From registration to resolution" icon={<Gauge className="h-5 w-5" aria-hidden />} tone="info" />
        <StatCard loading={loading} label="Pending rate" value={formatPercent(kpis?.pendingRate ?? 0)} hint={`${formatNumber(kpis?.pending ?? 0)} awaiting action`} icon={<Filter className="h-5 w-5" aria-hidden />} tone="warning" />
        <StatCard loading={loading} label="Rejection rate" value={formatPercent(kpis?.rejectionRate ?? 0)} hint={`${formatNumber(kpis?.rejected ?? 0)} rejected`} icon={<Filter className="h-5 w-5" aria-hidden />} tone="danger" />
        <StatCard loading={loading} label="Most common category" value={kpis?.mostCommonCategory?.name ?? '—'} hint={kpis?.mostCommonCategory ? `${kpis.mostCommonCategory.count} complaints (${kpis.mostCommonCategory.percentage}%)` : 'No data yet'} icon={<Trophy className="h-5 w-5" aria-hidden />} tone="primary" />
        <StatCard loading={loading} label="Highest complaint ward" value={kpis?.highestComplaintWard?.name?.replace(/ —.*/, '') ?? '—'} hint={kpis?.highestComplaintWard ? `${kpis.highestComplaintWard.count} complaints` : 'No data yet'} icon={<Users className="h-5 w-5" aria-hidden />} tone="neutral" />
        <StatCard loading={loading} label="Monthly growth" value={`${(kpis?.monthlyGrowth ?? 0) > 0 ? '+' : ''}${kpis?.monthlyGrowth ?? 0}%`} hint={`${formatNumber(kpis?.thisMonth ?? 0)} this month vs ${formatNumber(kpis?.lastMonth ?? 0)} last month`} icon={<TrendingUp className="h-5 w-5" aria-hidden />} tone="info" />
      </div>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Monthly complaint statistics"
          subtitle="Registered, resolved and pending complaints by month"
          loading={loading}
          empty={!charts?.monthly?.series?.length}
          action={
            <select className="field w-auto px-2 py-1 text-xs" value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Select report year">
              {(charts?.monthly?.years ?? [new Date().getFullYear()]).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          }
        >
          <MonthlyLineChart data={charts?.monthly?.series ?? []} />
        </ChartCard>

        <ChartCard title="Resolved vs pending" subtitle="Status distribution with percentages" loading={loading} empty={!charts?.statuses?.length}>
          <StatusDonutChart data={charts?.statuses ?? []} />
        </ChartCard>

        <ChartCard className="xl:col-span-2" title="Complaints by category" subtitle="Count and share of each civic category" loading={loading} empty={!charts?.categories?.length}>
          <CategoryBarChart data={charts?.categories ?? []} />
        </ChartCard>

        <Card>
          <CardHeader icon={<Trophy className="h-4 w-4" aria-hidden />} title="Category share" subtitle="Percentage of total complaints" />
          {loading ? (
            <SkeletonCard />
          ) : (
            <ul className="space-y-3">
              {(charts?.categories ?? []).slice(0, 6).map((entry) => (
                <li key={entry.category}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.colour }} aria-hidden />
                      {entry.category}
                    </span>
                    <span className="text-muted">
                      {entry.count} • {entry.percentage}%
                    </span>
                  </div>
                  <ProgressBar className="mt-1.5" value={entry.percentage} colour={entry.colour} />
                </li>
              ))}
              {(charts?.categories ?? []).length === 0 && <li className="text-xs text-muted">No category data available.</li>}
            </ul>
          )}
        </Card>

        <ChartCard className="xl:col-span-3" title="Ward-wise complaint distribution" subtitle="Registered versus resolved complaints per ward" loading={loading} empty={!charts?.wards?.length}>
          <WardBarChart data={charts?.wards ?? []} />
        </ChartCard>
      </div>

      {/* ── Report builder (§20) — administrators only ─────────────────── */}
      {!isAdmin && (
        <Card className="mt-5 border-primary/25 bg-primary-soft/30">
          <CardHeader
            icon={<FileText className="h-4 w-4" aria-hidden />}
            title="Report generation is available to administrators"
            subtitle="Your dashboard above is scoped to the complaints you can see. Ask a village office administrator to export the official PDF report."
          />
          <p className="text-xs text-muted">
            Administrators can build filtered reports (date range, category, ward, officer, status and priority) and export them as a
            PDF with the Government of Tamil Nadu report heading, or download the data as CSV.
          </p>
        </Card>
      )}

      {isAdmin && (
        <>
          <Card className="mt-5">
        <CardHeader
          icon={<FileText className="h-4 w-4" aria-hidden />}
          title="Generate a report"
          subtitle="Choose the filters, preview the report on screen and export it as a PDF with the government heading."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
              <Button variant="primary" loading={generating} onClick={generate} icon={<FileText className="h-4 w-4" />}>
                Generate report
              </Button>
              <Button variant="secondary" loading={exporting} onClick={exportPdf} icon={<Printer className="h-4 w-4" />}>
                Export PDF
              </Button>
            </div>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="report-from">
              From date
            </label>
            <input id="report-from" type="date" className="field" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilter({ from: event.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="report-to">
              To date
            </label>
            <input id="report-to" type="date" className="field" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilter({ to: event.target.value })} />
          </div>
          <Select label="Category" value={filters.categoryId} onChange={(event) => setFilter({ categoryId: event.target.value })} placeholder="All categories" options={(categories ?? []).map((category) => ({ value: category.id, label: category.name }))} />
          <Select label="Ward" value={filters.wardId} onChange={(event) => setFilter({ wardId: event.target.value })} placeholder="All wards" options={(wards ?? []).map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` }))} />
          {isAdmin && (
            <Select label="Officer" value={filters.officerId} onChange={(event) => setFilter({ officerId: event.target.value })} placeholder="All officers" options={(officers ?? []).map((officer) => ({ value: officer.id, label: officer.name }))} />
          )}
          <Select label="Status" value={filters.status} onChange={(event) => setFilter({ status: event.target.value })} options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} />
          <Select label="Priority" value={filters.priority} onChange={(event) => setFilter({ priority: event.target.value })} options={PRIORITY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} />
        </div>
      </Card>

        </>
      )}

      {/* ── Report preview (administrators only) ──────────────────────── */}
      {isAdmin && generated ? (
        <Card className="mt-5">
          <div className="border-b border-line pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Logo compact />
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{generated.meta.organisation}</p>
                  <h2 className="text-lg font-bold tracking-tight text-ink">{generated.meta.title}</h2>
                  <p className="text-2xs text-muted">{generated.meta.subtitle}</p>
                </div>
              </div>
              <div className="text-right text-2xs text-muted">
                <p>Generated: {new Date(generated.meta.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
                <p>
                  By: {generated.meta.generatedBy} ({generated.meta.generatedByRole})
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="border-line bg-elevated text-muted">From: {generated.filters.from ?? 'Any'}</Badge>
              <Badge className="border-line bg-elevated text-muted">To: {generated.filters.to ?? 'Any'}</Badge>
              <Badge className="border-line bg-elevated text-muted">Status: {generated.filters.status ?? 'All'}</Badge>
              <Badge className="border-line bg-elevated text-muted">Priority: {generated.filters.priority ?? 'All'}</Badge>
              <Badge className="border-line bg-elevated text-muted">Category: {generated.filters.category ?? 'All'}</Badge>
              <Badge className="border-line bg-elevated text-muted">Ward: {generated.filters.ward ?? 'All'}</Badge>
              {isAdmin && <Badge className="border-line bg-elevated text-muted">Officer: {generated.filters.officer ?? 'All'}</Badge>}
            </div>
          </div>

          {/* Summary statistics */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Total complaints', generated.summary.total],
              ['Resolved', `${generated.summary.resolved} (${generated.summary.resolutionRate}%)`],
              ['In progress', generated.summary.inProgress],
              ['Pending', `${generated.summary.pending} (${generated.summary.pendingRate}%)`],
              ['Rejected', `${generated.summary.rejected} (${generated.summary.rejectionRate}%)`],
              ['Average resolution time', `${generated.summary.averageResolutionDays} days`],
              ['High & critical priority', `${(generated.summary.byPriority.high ?? 0) + (generated.summary.byPriority.critical ?? 0)}`],
              ['Officers involved', generated.summary.byOfficer.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-line bg-elevated/50 p-3">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-0.5 text-lg font-bold text-ink">{value}</p>
              </div>
            ))}
          </div>

          {/* Resolution statistics + breakdowns */}
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div>
              <h3 className="panel-title">Resolution statistics</h3>
              <dl className="mt-2 space-y-2 text-xs">
                {[
                  ['Total', generated.summary.total],
                  ['Resolved', `${generated.summary.resolved} (${generated.summary.resolutionRate}%)`],
                  ['Pending', `${generated.summary.pending} (${generated.summary.pendingRate}%)`],
                  ['Rejected', `${generated.summary.rejected} (${generated.summary.rejectionRate}%)`],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between border-b border-line/60 pb-1.5">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-semibold text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="panel-title">Top categories</h3>
              <ul className="mt-2 space-y-2 text-xs">
                {generated.summary.byCategory.slice(0, 5).map((entry) => (
                  <li key={entry.name}>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">{entry.name}</span>
                      <span className="font-semibold text-ink">
                        {entry.count} ({entry.percentage}%)
                      </span>
                    </div>
                    <ProgressBar className="mt-1" value={entry.percentage} />
                  </li>
                ))}
                {!generated.summary.byCategory.length && <li className="text-muted">No data for the selected period.</li>}
              </ul>
            </div>
            <div>
              <h3 className="panel-title">Ward & officer distribution</h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                {generated.summary.byWard.slice(0, 4).map((entry) => (
                  <li key={entry.name} className="flex items-center justify-between">
                    <span className="text-muted">{entry.name}</span>
                    <span className="font-semibold text-ink">{entry.count}</span>
                  </li>
                ))}
                {generated.summary.byOfficer.slice(0, 3).map((entry) => (
                  <li key={entry.name} className="flex items-center justify-between border-t border-line/60 pt-1.5">
                    <span className="text-muted">Officer {entry.name}</span>
                    <span className="font-semibold text-ink">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Complaint table */}
          <div className="mt-6">
            <h3 className="panel-title">Complaint register ({generated.complaints.length})</h3>
            {generated.complaints.length === 0 ? (
              <EmptyState compact title="No reports available for this period" description="No complaints matched the selected filters. Adjust the date range or clear a filter." />
            ) : (
              <div className="table-wrap mt-3">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Complaint ID</th>
                      <th scope="col">Citizen</th>
                      <th scope="col">Category</th>
                      <th scope="col">Ward</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Officer</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generated.complaints.slice(0, 100).map((row) => (
                      <tr key={row.id}>
                        <td className="font-mono text-xs font-semibold text-primary">{row.complaintId}</td>
                        <td className="text-xs">{row.citizenName}</td>
                        <td className="text-xs">{row.category}</td>
                        <td className="text-xs text-muted">{row.ward?.replace(/ —.*/, '') ?? '—'}</td>
                        <td>
                          <PriorityBadge priority={row.priority} />
                        </td>
                        <td>
                          <StatusBadge status={row.status} label={row.statusLabel} />
                        </td>
                        <td className="text-xs text-muted">{row.officer ?? 'Not assigned'}</td>
                        <td className="whitespace-nowrap text-xs text-muted">{formatDate(row.complaintDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {generated.complaints.length > 100 && (
                  <p className="mt-2 text-2xs text-muted">
                    Showing the first 100 of {generated.complaints.length} complaints on screen — the PDF export includes all rows.
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="mt-5 border-t border-line pt-3 text-2xs text-muted">{generated.meta.disclaimer}</p>
        </Card>
      ) : isAdmin ? (
        <Card className="mt-5">
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="No report generated yet"
            description={`Choose your filters above and select “Generate report” to preview the report${isAdmin ? ', then export it as a PDF' : ''}.`}
            action={
              <Button variant="primary" loading={generating} onClick={generate} icon={<FileText className="h-4 w-4" />}>
                Generate report
              </Button>
            }
          />
        </Card>
      ) : null}

      {loading && (
        <Card className="mt-5">
          <SkeletonTable rows={4} columns={5} />
        </Card>
      )}

      <p className="mt-4 text-center text-2xs text-muted">
        Reports are generated from live data. {branding?.appName ?? 'VCMS'} • demonstration build.
      </p>
    </>
  );
};

export default ReportsPage;
