import { useEffect, useState } from 'react';
import { CheckCircle2, Wrench, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { STATUS_META } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import type { ComplaintStatus, ComplaintSummary, FieldErrors } from '@/types';

interface StatusUpdateDialogProps {
  open: boolean;
  complaint: ComplaintSummary | null;
  onClose: () => void;
  onUpdated: (complaint: ComplaintSummary) => void;
}

const NEXT_STATUS: Record<ComplaintStatus, { value: ComplaintStatus; label: string; description: string; icon: typeof Wrench }[]> = {
  pending: [
    { value: 'in_progress', label: 'Start investigation', description: 'Move to In Progress', icon: Wrench },
  ],
  in_progress: [
    { value: 'resolved', label: 'Mark as resolved', description: 'Issue has been fixed', icon: CheckCircle2 },
  ],
  resolved: [
    { value: 'in_progress', label: 'Reopen as in progress', description: 'Issue reported again', icon: Wrench },
  ],
  rejected: [
    { value: 'in_progress', label: 'Reopen as in progress', description: 'Reconsider the complaint', icon: Wrench },
  ],
};

/** Status change dialog with the remarks required by the workflow (§38/§39). */
export const StatusUpdateDialog = ({ open, complaint, onClose, onUpdated }: StatusUpdateDialogProps) => {
  const [status, setStatus] = useState<ComplaintStatus>('in_progress');
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open || !complaint) return;
    const options = NEXT_STATUS[complaint.status] ?? [];
    setStatus(options[0]?.value ?? 'in_progress');
    setRemarks('');
    setErrors({});
  }, [open, complaint]);

  if (!complaint) return null;

  const options = NEXT_STATUS[complaint.status] ?? [];

  const submit = async () => {
    const nextErrors: FieldErrors = {};
    if (status === 'resolved' && remarks.trim().length < 10) {
      nextErrors.remarks = 'Describe the resolution in at least 10 characters so the citizen knows what was done.';
    }
    if (status === 'rejected' && remarks.trim().length < 10) {
      nextErrors.remarks = 'A rejection reason of at least 10 characters is required.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const updated = await api.put<ComplaintSummary>(`/complaints/${complaint.id}/status`, {
        status,
        remarks: remarks.trim() || undefined,
        ...(status === 'resolved' ? { resolutionRemarks: remarks.trim() } : {}),
        ...(status === 'rejected' ? { rejectionReason: remarks.trim() } : {}),
      });
      toast.success('Status updated', `${complaint.complaintId} is now ${STATUS_META[status].label}. The citizen has been notified.`);
      onUpdated(updated);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The status could not be updated.';
      toast.error('Update failed', message);
      setErrors({ remarks: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update complaint status"
      description={`${complaint.complaintId} • ${complaint.categoryName}`}
      icon={<Wrench className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting} touch>
            Cancel
          </Button>
          <Button variant={status === 'resolved' ? 'success' : status === 'rejected' ? 'danger' : 'primary'} onClick={submit} loading={submitting} touch>
            Save status
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2 text-xs text-muted">
        Current status: <StatusBadge status={complaint.status} label={complaint.statusLabel} />
      </div>

      <fieldset>
        <legend className="label">New status</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const Icon = option.icon;
            const active = status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                aria-pressed={active}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200',
                  active ? 'border-primary bg-primary-soft/70 shadow-card' : 'border-line bg-surface hover:border-primary/40',
                )}
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted')} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-ink">{option.label}</span>
                  <span className="block text-2xs text-muted">{option.description}</span>
                </span>
              </button>
            );
          })}

          {complaint.status === 'in_progress' && (
            <button
              type="button"
              onClick={() => setStatus('rejected')}
              aria-pressed={status === 'rejected'}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200',
                status === 'rejected' ? 'border-danger bg-danger-soft/60 shadow-card' : 'border-line bg-surface hover:border-danger/40',
              )}
            >
              <XCircle className={cn('mt-0.5 h-4 w-4 shrink-0', status === 'rejected' ? 'text-danger' : 'text-muted')} aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-ink">Reject complaint</span>
                <span className="block text-2xs text-muted">Not a valid grievance for this panchayat</span>
              </span>
            </button>
          )}
        </div>
      </fieldset>

      <Textarea
        containerClassName="mt-4"
        label={status === 'resolved' ? 'Resolution remarks (required)' : status === 'rejected' ? 'Reason for rejection (required)' : 'Remarks (optional)'}
        value={remarks}
        error={errors.remarks}
        maxLength={2000}
        showCount
        onChange={(event) => setRemarks(event.target.value)}
        placeholder={
          status === 'resolved'
            ? 'For example: LED fitting replaced and the pole is glowing since last night.'
            : status === 'rejected'
              ? 'For example: The reported location is outside this village panchayat limit.'
              : 'Add any notes for the complaint history.'
        }
      />

      {status === 'resolved' && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-success-soft p-2.5 text-2xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          The resolution date is recorded automatically and the citizen is notified immediately.
        </p>
      )}
      {status === 'rejected' && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-danger-soft p-2.5 text-2xs text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          The rejection reason is stored with your user id and timestamp, and shown to the citizen.
        </p>
      )}
    </Modal>
  );
};

export default StatusUpdateDialog;
