import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, FileSearch, MapPin, Phone, RefreshCw, Search, UserCog } from 'lucide-react';
import { ApiError, api, buildQuery } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { categoryIcon } from '@/lib/constants';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonText } from '@/components/ui/Skeleton';
import { Timeline } from '@/components/ui';
import PageHeader from '@/components/layout/PageHeader';
import type { ComplaintDetail } from '@/types';

/**
 * Track status page (§12): search by complaint ID or ration number and view the
 * complete timeline of each matching complaint.
 */
export const TrackPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [complaintId, setComplaintId] = useState(searchParams.get('complaintId') ?? '');
  const [rationNumber, setRationNumber] = useState(searchParams.get('rationNumber') ?? '');
  const [mode, setMode] = useState<'id' | 'ration'>(searchParams.get('rationNumber') ? 'ration' : 'id');
  const [results, setResults] = useState<ComplaintDetail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const toast = useToast();

  const search = async (payload?: { complaintId?: string; rationNumber?: string }) => {
    const query = buildQuery({
      complaintId: payload?.complaintId ?? (mode === 'id' ? complaintId.trim() : undefined),
      rationNumber: payload?.rationNumber ?? (mode === 'ration' ? rationNumber.trim() : undefined),
    });
    if (!query) {
      setError(mode === 'id' ? 'Enter a complaint ID to track.' : 'Enter a ration number to track.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ComplaintDetail[]>(`/complaints/track?${query}`);
      setResults(data);
      if (!data.length) setError('No complaint found for the details provided.');
    } catch (err) {
      setResults(null);
      setError(err instanceof ApiError ? err.message : 'Unable to look up the complaint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-search when arriving from a notification link.
  useEffect(() => {
    const id = searchParams.get('complaintId');
    const ration = searchParams.get('rationNumber');
    if (id) void search({ complaintId: id });
    else if (ration) void search({ rationNumber: ration });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearchParams(buildParams(), { replace: true });
    await search();
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    if (mode === 'id' && complaintId.trim()) params.set('complaintId', complaintId.trim().toUpperCase());
    if (mode === 'ration' && rationNumber.trim()) params.set('rationNumber', rationNumber.trim().toUpperCase());
    return params;
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied', 'Complaint reference number copied.');
    } catch {
      toast.warning('Copy failed', 'Please copy the reference number manually.');
    }
  };

  return (
    <>
      <PageHeader
        title="Track complaint status"
        description="Enter your complaint ID (for example VCMS-2026-001245) or your ration number to see the current stage of your grievance."
      />

      <Card>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Search method">
          {[
            { id: 'id', label: 'By complaint ID' },
            { id: 'ration', label: 'By ration number' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              onClick={() => {
                setMode(tab.id as 'id' | 'ration');
                setError(null);
                setResults(null);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                mode === tab.id ? 'bg-primary text-primary-fg shadow-card' : 'text-muted hover:bg-primary-soft/70 hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          {mode === 'id' ? (
            <Input
              containerClassName="flex-1"
              label="Complaint ID"
              value={complaintId}
              onChange={(event) => setComplaintId(event.target.value.toUpperCase())}
              placeholder="VCMS-2026-001245"
              icon={<Search className="h-4 w-4" />}
              hint="The reference number you received when registering the complaint"
            />
          ) : (
            <Input
              containerClassName="flex-1"
              label="Ration number"
              value={rationNumber}
              onChange={(event) => setRationNumber(event.target.value.toUpperCase())}
              placeholder="TN123456789"
              icon={<Search className="h-4 w-4" />}
              hint="All complaints registered with this ration number are listed"
            />
          )}
          <Button type="submit" loading={loading} icon={<FileSearch className="h-4 w-4" />} className="sm:mb-0" touch>
            Track complaint
          </Button>
        </form>

        {!user && (
          <p className="mt-3 rounded-lg border border-warning/40 bg-warning-soft/60 p-3 text-xs text-warning">
            You are browsing as a guest. <Link to="/login" className="underline">Sign in</Link> to track your complaints — tracking is
            restricted to the citizen who registered the complaint, the assigned officer and administrators.
          </p>
        )}
      </Card>

      <div className="mt-5 space-y-5">
        {loading && (
          <Card>
            <SkeletonText lines={6} />
          </Card>
        )}

        {!loading && error && (
          <Card>
            <EmptyState
              icon={<FileSearch className="h-7 w-7" />}
              title="No complaint found"
              description={error}
              action={
                <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void search()}>
                  Try again
                </Button>
              }
            />
          </Card>
        )}

        {!loading && !error && results?.length === 0 && (
          <Card>
            <EmptyState title="No complaints registered yet" description="Nothing was found for the details provided." />
          </Card>
        )}

        {!loading &&
          (results ?? []).map((complaint) => {
            const Icon = categoryIcon(complaint.categoryIcon);
            return (
              <Card key={complaint.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${complaint.categoryColour}1a`, color: complaint.categoryColour ?? undefined }}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <button type="button" onClick={() => void copy(complaint.complaintId)} className="font-mono text-sm font-bold text-primary hover:underline" title="Copy reference number">
                        {complaint.complaintId}
                      </button>
                      <p className="text-sm font-semibold text-ink">{complaint.categoryName}</p>
                      <p className="text-2xs text-muted">
                        {complaint.citizenName} • {complaint.wardName ?? 'Ward not linked'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={complaint.priority} label={complaint.priorityLabel} />
                    <StatusBadge status={complaint.status} label={complaint.statusLabel} />
                  </div>
                </div>

                <p className="mt-3 rounded-lg bg-elevated/70 p-3 text-sm leading-relaxed text-muted">{complaint.description}</p>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ['Location', complaint.location, <MapPin className="h-3.5 w-3.5" key="loc" aria-hidden />],
                    ['Complaint date', formatDate(complaint.complaintDate), <Clock className="h-3.5 w-3.5" key="date" aria-hidden />],
                    ['Assigned officer', complaint.assignedOfficerName ?? 'Not assigned yet', <UserCog className="h-3.5 w-3.5" key="off" aria-hidden />],
                    ['Resolution date', complaint.resolutionDate ? formatDate(complaint.resolutionDate) : 'Pending', <CheckCircle2 className="h-3.5 w-3.5" key="res" aria-hidden />],
                  ].map(([label, value, icon]) => (
                    <div key={String(label)} className="rounded-lg border border-line bg-surface p-3">
                      <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
                        {icon}
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-xs font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>

                {(complaint.resolutionRemarks || complaint.remarks) && (
                  <div className="mt-3 rounded-lg border border-line bg-elevated/60 p-3">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
                      {complaint.status === 'resolved' ? 'Resolution remarks' : 'Latest remark'}
                    </p>
                    <p className="mt-1 text-sm text-ink">{complaint.resolutionRemarks ?? complaint.remarks}</p>
                  </div>
                )}

                <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
                  <div>
                    <h3 className="panel-title mb-3">Complaint timeline</h3>
                    <Timeline history={complaint.history} />
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-line bg-elevated/50 p-3 text-xs">
                      <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Assigned officer</p>
                      <p className="mt-1 font-semibold text-ink">{complaint.assignedOfficerName ?? 'Not assigned yet'}</p>
                      {complaint.assignment?.officerMobile && (
                        <a href={`tel:${complaint.assignment.officerMobile}`} className="mt-1 flex items-center gap-1.5 text-primary">
                          <Phone className="h-3.5 w-3.5" aria-hidden /> {complaint.assignment.officerMobile}
                        </a>
                      )}
                      {complaint.assignment?.assignedAt && (
                        <p className="mt-1 text-muted">Assigned {formatDateTime(complaint.assignment.assignedAt)}</p>
                      )}
                    </div>
                    <Link to={`/complaints/${complaint.id}`} className="btn btn-secondary w-full justify-center">
                      Open full complaint details <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
      </div>
    </>
  );
};

export default TrackPage;
