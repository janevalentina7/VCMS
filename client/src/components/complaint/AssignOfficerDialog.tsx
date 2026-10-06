import { useEffect, useMemo, useState } from 'react';
import { UserPlus, MapPin, AlertTriangle, Briefcase } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { PRIORITY_META } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Badge, PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Select, Textarea } from '@/components/ui/Input';
import { SkeletonText } from '@/components/ui/Skeleton';
import type { ComplaintSummary } from '@/types';

interface Officer {
  id: number;
  name: string;
  wardName: string | null;
  designation: string | null;
  activeAssignments: number;
  resolvedCount: number;
}

interface AssignOfficerDialogProps {
  open: boolean;
  complaint: ComplaintSummary | null;
  onClose: () => void;
  onAssigned: (complaint: ComplaintSummary) => void;
}

/** Officer assignment dialog (§15) with live workload hints. */
export const AssignOfficerDialog = ({ open, complaint, onClose, onAssigned }: AssignOfficerDialogProps) => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [officerId, setOfficerId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setOfficerId('');
    setNotes('');
    setError(null);
    setLoading(true);
    api
      .get<Officer[]>('/users/officers')
      .then(setOfficers)
      .catch(() => setError('Unable to load the officer list. Please try again.'))
      .finally(() => setLoading(false));
  }, [open]);

  const selected = useMemo(() => officers.find((officer) => String(officer.id) === officerId), [officers, officerId]);

  const submit = async () => {
    if (!complaint || !officerId) {
      setError('Select an officer to assign this complaint.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.post<ComplaintSummary>(`/complaints/${complaint.id}/assign`, {
        officerId: Number(officerId),
        notes: notes.trim() || undefined,
      });
      toast.success('Complaint assigned', `${complaint.complaintId} is now with ${selected?.name}. The officer has been notified.`);
      onAssigned(updated);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The complaint could not be assigned.';
      setError(message);
      toast.error('Assignment failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign complaint to a village officer"
      description="The officer receives an in-app notification immediately after assignment."
      icon={<UserPlus className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting} touch>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting} disabled={!officerId} touch>
            Assign Complaint
          </Button>
        </>
      }
    >
      {complaint && (
        <div className="mb-4 rounded-xl border border-line bg-elevated/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold text-primary">{complaint.complaintId}</span>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={complaint.priority} label={complaint.priorityLabel} />
              <StatusBadge status={complaint.status} label={complaint.statusLabel} />
            </div>
          </div>
          <dl className="mt-2.5 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">Category</dt>
              <dd className="text-ink">{complaint.categoryName}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">Registered</dt>
              <dd className="text-ink">{formatDate(complaint.complaintDate)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted">
                <MapPin className="h-3 w-3" aria-hidden /> Location
              </dt>
              <dd className="text-ink">{complaint.location}</dd>
            </div>
            {complaint.assignedOfficerName && (
              <div className="sm:col-span-2">
                <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">Currently assigned to</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />
                  {complaint.assignedOfficerName} — selecting another officer will re-assign the complaint.
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {loading ? (
        <SkeletonText lines={3} />
      ) : (
        <div className="space-y-4">
          <Select
            label="Select officer"
            required
            value={officerId}
            error={error ?? undefined}
            onChange={(event) => setOfficerId(event.target.value)}
            placeholder="Choose a village officer"
            options={officers.map((officer) => ({
              value: officer.id,
              label: `${officer.name}${officer.wardName ? ` — ${officer.wardName}` : ''} (${officer.activeAssignments} active)`,
            }))}
            hint={officers.length === 0 ? 'No active officers are available. Add an officer from the Users page.' : 'Workload is shown in brackets.'}
          />

          {selected && (
            <div className="rounded-xl border border-line bg-primary-soft/40 p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Briefcase className="h-4 w-4 text-primary" aria-hidden />
                {selected.name}
              </p>
              <p className="mt-0.5 text-xs text-muted">{selected.designation ?? 'Village Officer'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge className="border-line bg-surface text-muted">Ward: {selected.wardName ?? 'Not linked'}</Badge>
                <Badge className={cn('border-line bg-surface', selected.activeAssignments > 6 ? 'text-warning' : 'text-muted')}>
                  Active workload: {selected.activeAssignments}
                </Badge>
                <Badge className="border-line bg-surface text-success">Resolved: {selected.resolvedCount}</Badge>
              </div>
              {selected.activeAssignments > 6 && (
                <p className="mt-2 text-2xs text-warning">
                  This officer already has a high workload — consider another officer for faster resolution.
                </p>
              )}
            </div>
          )}

          <Textarea
            label="Assignment notes (optional)"
            value={notes}
            maxLength={255}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="For example: Inspect the location today and report the material requirement."
            hint="Visible to the officer in the complaint history."
          />
        </div>
      )}
    </Modal>
  );
};

export default AssignOfficerDialog;
