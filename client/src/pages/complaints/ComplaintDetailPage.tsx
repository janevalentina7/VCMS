import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  FileImage,
  History,
  MapPin,
  MessageSquarePlus,
  PencilLine,
  Phone,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  User,
  UserPlus,
  Wrench,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate, formatDateTime, daysSince, truncate } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ACTION_LABELS, categoryIcon } from '@/lib/constants';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge, PriorityBadge, PriorityMeter, StatusBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonText } from '@/components/ui/Skeleton';
import { Timeline } from '@/components/ui';
import AssignOfficerDialog from '@/components/complaint/AssignOfficerDialog';
import StatusUpdateDialog from '@/components/complaint/StatusUpdateDialog';
import RemarkDialog from '@/components/complaint/RemarkDialog';
import ComplaintEditDialog from '@/components/complaint/ComplaintEditDialog';
import { ConfirmDialog } from '@/components/ui/Modal';
import type { Category, ComplaintDetail, ComplaintSummary, Ward } from '@/types';

const InfoRow = ({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2.5 last:border-0">
    <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
      {icon}
      {label}
    </dt>
    <dd className="max-w-[62%] text-right text-sm font-medium text-ink">{value}</dd>
  </div>
);

/** Full complaint page: information, citizen, location, evidence, assignment, resolution, history (§13). */
export const ComplaintDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: complaint, loading, error, reload } = useAsync<ComplaintDetail>((signal) => api.get<ComplaintDetail>(`/complaints/${id}`, signal), [id]);
  const { data: categories = [] } = useAsync<Category[]>((signal) => api.get<Category[]>('/categories', signal), []);
  const { data: wards = [] } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards', signal), []);

  const copyReference = async () => {
    if (!complaint) return;
    try {
      await navigator.clipboard.writeText(complaint.complaintId);
      toast.success('Copied', 'Complaint reference number copied to the clipboard.');
    } catch {
      toast.warning('Copy failed', 'Please copy the reference number manually.');
    }
  };

  const onDelete = async () => {
    if (!complaint) return;
    setDeleting(true);
    try {
      await api.delete(`/complaints/${complaint.id}`);
      toast.success('Complaint deleted', `${complaint.complaintId} has been removed.`);
      navigate('/complaints', { replace: true });
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card><SkeletonText lines={8} /></Card>
        <Card><SkeletonText lines={6} /></Card>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <Card>
        <ErrorState
          title="Unable to load this complaint"
          message={error ?? 'The complaint could not be found or you do not have access to it.'}
          onRetry={reload}
        />
        <div className="mt-4 text-center">
          <Link to="/complaints" className="btn btn-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to complaints
          </Link>
        </div>
      </Card>
    );
  }

  const Icon = categoryIcon(complaint.categoryIcon);
  const role = user?.role ?? 'citizen';
  const age = daysSince(complaint.complaintDate);
  const resolutionDays = complaint.resolutionDate
    ? Math.max(0, Math.round((new Date(complaint.resolutionDate).getTime() - new Date(complaint.complaintDate).getTime()) / 86400000))
    : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/complaints" className="btn btn-ghost btn-sm" aria-label="Back to complaint list">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-lg font-bold tracking-tight text-ink sm:text-xl">{complaint.complaintId}</h1>
              <Button variant="ghost" size="sm" onClick={copyReference} icon={<Copy className="h-3.5 w-3.5" />} className="px-2">
                <span className="sr-only">Copy reference number</span>
              </Button>
              <StatusBadge status={complaint.status} label={complaint.statusLabel} />
              <PriorityBadge priority={complaint.priority} label={complaint.priorityLabel} />
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Registered {formatDate(complaint.complaintDate)} • {age} day(s) old
              {complaint.wardName ? ` • ${complaint.wardName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={reload}>
            Refresh
          </Button>
          {(role === 'admin' || role === 'officer') && (
            <Button variant="secondary" icon={<MessageSquarePlus className="h-4 w-4" />} onClick={() => setRemarkOpen(true)}>
              Add remark
            </Button>
          )}
          {role === 'admin' && complaint.status === 'pending' && (
            <Button
              variant="success"
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={async () => {
                try {
                  await api.post(`/complaints/${complaint.id}/approve`, {});
                  toast.success('Complaint approved', 'It is now In Progress and ready for officer assignment.');
                  reload();
                } catch (err) {
                  toast.error('Approval failed', err instanceof Error ? err.message : 'Please try again.');
                }
              }}
            >
              Approve
            </Button>
          )}
          {role === 'admin' && complaint.status !== 'resolved' && complaint.status !== 'rejected' && (
            <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAssignOpen(true)}>
              {complaint.assignedOfficerName ? 'Re-assign' : 'Assign officer'}
            </Button>
          )}
          {(role === 'admin' || (role === 'officer' && complaint.assignedOfficerId === user?.id)) && (
            <Button variant="primary" icon={<Wrench className="h-4 w-4" />} onClick={() => setStatusOpen(true)}>
              Update status
            </Button>
          )}
          {role === 'admin' && (
            <>
              <Button variant="ghost" icon={<PencilLine className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button variant="ghost" className="text-danger hover:bg-danger-soft" icon={<XCircle className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Resolution / rejection banner */}
      {complaint.status === 'resolved' && (
        <Card className="mb-5 border-success/40 bg-success-soft/50">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success text-white">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Issue resolved{resolutionDays !== null ? ` in ${resolutionDays} day(s)` : ''}</p>
              <p className="mt-1 text-sm text-muted">{complaint.resolutionRemarks ?? complaint.remarks ?? 'Resolution recorded by the officer.'}</p>
              <p className="mt-1 text-2xs text-muted">
                Resolved on {formatDateTime(complaint.resolutionDate)} • {complaint.assignedOfficerName ?? 'Village administration'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {complaint.status === 'rejected' && (
        <Card className="mb-5 border-danger/40 bg-danger-soft/50">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger text-white">
              <XCircle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Complaint rejected by the administration</p>
              <p className="mt-1 text-sm text-muted">{complaint.rejectionReason ?? 'No reason recorded.'}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card>
            <CardHeader icon={<History className="h-4 w-4" aria-hidden />} title="Complaint information" subtitle="As registered by the citizen" />
            <div className="flex items-start gap-3 rounded-xl border border-line bg-elevated/50 p-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${complaint.categoryColour}1a`, color: complaint.categoryColour ?? undefined }}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{complaint.categoryName}</p>
                <p className="text-2xs text-muted">{complaint.wardName ?? 'Ward not linked'}</p>
              </div>
            </div>

            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink">{complaint.description}</p>

            <dl className="mt-4">
              <InfoRow label="Complaint ID" value={<span className="font-mono">{complaint.complaintId}</span>} />
              <InfoRow label="Priority" value={<span className="flex items-center justify-end gap-2">{complaint.priorityLabel} <PriorityMeter priority={complaint.priority} /></span>} />
              <InfoRow label="Registered on" value={formatDateTime(complaint.complaintDate)} icon={<CalendarDays className="h-3 w-3" aria-hidden />} />
              <InfoRow label="Last updated" value={formatDateTime(complaint.updatedAt)} />
              <InfoRow label="Approved on" value={complaint.approvedAt ? formatDateTime(complaint.approvedAt) : 'Awaiting approval'} />
              <InfoRow label="Resolution date" value={complaint.resolutionDate ? formatDateTime(complaint.resolutionDate) : 'Not resolved yet'} />
            </dl>

            {complaint.remarks && (
              <div className="mt-4 rounded-lg border border-line bg-elevated/60 p-3">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Latest remark</p>
                <p className="mt-1 text-sm text-ink">{complaint.remarks}</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={<FileImage className="h-4 w-4" aria-hidden />} title="Evidence" subtitle="Photograph uploaded with the complaint" />
            {complaint.imageUrl ? (
              <figure>
                <img
                  src={complaint.imageUrl}
                  alt={`Evidence uploaded for complaint ${complaint.complaintId} — ${complaint.categoryName} at ${complaint.location}`}
                  className="max-h-[420px] w-full rounded-xl border border-line object-contain"
                  loading="lazy"
                />
                <figcaption className="mt-2 text-2xs text-muted">
                  Uploaded by the citizen • stored as a compressed WEBP image with metadata removed.
                </figcaption>
              </figure>
            ) : (
              <EmptyState compact icon={<FileImage className="h-6 w-6" />} title="No evidence image" description="The citizen did not attach a photograph to this complaint." />
            )}
          </Card>

          <Card>
            <CardHeader icon={<History className="h-4 w-4" aria-hidden />} title="Complaint history" subtitle="Every status change is recorded with a timestamp" />
            <Timeline history={complaint.history} />
          </Card>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card>
            <CardHeader icon={<User className="h-4 w-4" aria-hidden />} title="Citizen information" />
            <dl>
              <InfoRow label="Name" value={complaint.citizen?.name ?? complaint.citizenName} />
              <InfoRow label="Ration number" value={complaint.rationNumber ?? '—'} />
              <InfoRow
                label="Mobile"
                value={
                  <a href={`tel:${complaint.mobileNumber}`} className="link flex items-center justify-end gap-1.5">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {complaint.mobileNumber}
                  </a>
                }
              />
              {user?.role !== 'citizen' && complaint.citizen?.email && <InfoRow label="Email" value={complaint.citizen.email} />}
              <InfoRow label="Address" value={complaint.citizen?.address ?? '—'} />
            </dl>
            {user?.role === 'citizen' && (
              <p className="mt-3 text-2xs text-muted">Your contact details are shared only with the officer handling this complaint.</p>
            )}
          </Card>

          <Card>
            <CardHeader icon={<MapPin className="h-4 w-4" aria-hidden />} title="Location" />
            <dl>
              <InfoRow label="Street" value={complaint.streetName} />
              <InfoRow label="Area" value={complaint.area ?? '—'} />
              <InfoRow label="Ward" value={complaint.wardName ?? '—'} />
              <InfoRow label="Location" value={complaint.location} />
            </dl>

            <div className="mt-3 overflow-hidden rounded-xl border border-line">
              {complaint.latitude && complaint.longitude ? (
                <a
                  className="flex items-center justify-between gap-2 bg-elevated/60 p-3 text-xs"
                  href={`https://www.openstreetmap.org/?mlat=${complaint.latitude}&mlon=${complaint.longitude}#map=18/${complaint.latitude}/${complaint.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <MapPinned className="h-4 w-4 text-primary" aria-hidden /> GPS coordinates recorded
                  </span>
                  <span className="font-mono text-2xs text-muted">
                    {complaint.latitude}, {complaint.longitude}
                  </span>
                </a>
              ) : (
                <div className="bg-elevated/60 p-3 text-2xs text-muted">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <MapPinned className="h-4 w-4 text-muted" aria-hidden /> Map view not available
                  </p>
                  <p className="mt-1 leading-relaxed">
                    No GPS coordinates were captured. The location layer supports latitude/longitude, so map pinning can be enabled
                    without changing the database.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={<UserPlus className="h-4 w-4" aria-hidden />} title="Assignment" />
            {complaint.assignment ? (
              <dl>
                <InfoRow label="Assigned officer" value={complaint.assignment.officerName ?? '—'} />
                <InfoRow label="Assignment date" value={formatDateTime(complaint.assignment.assignedAt)} />
                <InfoRow label="Assigned by" value={complaint.assignment.assignedByName ?? 'Village administration'} />
                {complaint.assignment.officerMobile && user?.role !== 'citizen' && (
                  <InfoRow
                    label="Officer mobile"
                    value={
                      <a href={`tel:${complaint.assignment.officerMobile}`} className="link">
                        {complaint.assignment.officerMobile}
                      </a>
                    }
                  />
                )}
              </dl>
            ) : (
              <EmptyState compact icon={<Clock className="h-6 w-6" />} title="Not assigned yet" description="An administrator will assign a village officer shortly." />
            )}

            {complaint.assignments?.length > 1 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Assignment history</p>
                <ul className="mt-2 space-y-1.5 text-2xs text-muted">
                  {complaint.assignments.map((assignment) => (
                    <li key={assignment.id} className="flex items-center justify-between gap-2">
                      <span className={cn(assignment.active ? 'font-semibold text-ink' : '')}>{assignment.officerName}</span>
                      <span>{formatDate(assignment.assignedAt)}{assignment.unassignedAt ? ` → ${formatDate(assignment.unassignedAt)}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={<Wrench className="h-4 w-4" aria-hidden />} title="Resolution" />
            <dl>
              <InfoRow label="Status" value={<StatusBadge status={complaint.status} label={complaint.statusLabel} />} />
              <InfoRow label="Resolved on" value={complaint.resolutionDate ? formatDateTime(complaint.resolutionDate) : '—'} />
              <InfoRow label="Time taken" value={resolutionDays !== null ? `${resolutionDays} day(s)` : age !== null ? `${age} day(s) and counting` : '—'} />
            </dl>
            <div className="mt-3 rounded-lg border border-line bg-elevated/60 p-3">
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Resolution remarks</p>
              <p className="mt-1 text-sm text-ink">{complaint.resolutionRemarks ?? complaint.remarks ?? 'No resolution remarks recorded yet.'}</p>
            </div>
          </Card>

          <Card>
            <CardHeader icon={<History className="h-4 w-4" aria-hidden />} title="Recent activity" subtitle="Latest five history entries" />
            <ul className="space-y-2.5">
              {complaint.history.slice(-5).reverse().map((entry) => (
                <li key={entry.id} className="flex items-start gap-2.5 text-xs">
                  <Badge className="mt-0.5 border-line bg-elevated text-muted">{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                  <span className="min-w-0 flex-1 text-muted">
                    <span className="block text-ink">{truncate(entry.remarks ?? 'No remarks recorded.', 90)}</span>
                    <span className="block text-2xs">{formatDateTime(entry.timestamp)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <AssignOfficerDialog open={assignOpen} complaint={complaint as ComplaintSummary} onClose={() => setAssignOpen(false)} onAssigned={reload} />
      <StatusUpdateDialog open={statusOpen} complaint={complaint as ComplaintSummary} onClose={() => setStatusOpen(false)} onUpdated={reload} />
      <RemarkDialog open={remarkOpen} complaint={complaint as ComplaintSummary} onClose={() => setRemarkOpen(false)} onSaved={reload} />
      <ComplaintEditDialog
        open={editOpen}
        complaint={complaint as ComplaintSummary}
        categories={categories ?? []}
        wards={wards ?? []}
        onClose={() => setEditOpen(false)}
        onSaved={reload}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this complaint?"
        tone="danger"
        confirmLabel="Delete complaint"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        message={
          <>
            <p>
              Complaint <span className="font-mono font-semibold">{complaint.complaintId}</span> and its complete history will be
              permanently removed. This action cannot be undone.
            </p>
            <p className="mt-2 text-xs">Consider rejecting the complaint with a reason instead, so the citizen keeps a record.</p>
          </>
        }
      />
    </>
  );
};

export default ComplaintDetailPage;
