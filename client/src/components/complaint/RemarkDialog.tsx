import { useEffect, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import type { ComplaintSummary } from '@/types';

interface RemarkDialogProps {
  open: boolean;
  complaint: ComplaintSummary | null;
  onClose: () => void;
  onSaved: (complaint: ComplaintSummary) => void;
}

/** Adds a remark without changing status (§13 / §16). */
export const RemarkDialog = ({ open, complaint, onClose, onSaved }: RemarkDialogProps) => {
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setRemarks('');
    setError(undefined);
  }, [open]);

  if (!complaint) return null;

  const submit = async () => {
    if (remarks.trim().length < 3) {
      setError('Enter a remark of at least 3 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await api.post<ComplaintSummary>(`/complaints/${complaint.id}/remarks`, { remarks: remarks.trim() });
      toast.success('Remark added', 'The remark was recorded in the complaint history.');
      onSaved(updated);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The remark could not be saved.';
      toast.error('Could not add remark', message);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add remark"
      description={`${complaint.complaintId} • ${complaint.categoryName}`}
      icon={<MessageSquarePlus className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting} touch>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting} touch>
            Save remark
          </Button>
        </>
      }
    >
      <Textarea
        label="Remark"
        required
        value={remarks}
        error={error}
        maxLength={2000}
        showCount
        onChange={(event) => setRemarks(event.target.value)}
        placeholder="For example: Site inspected along with the assistant engineer; measurement taken for repair."
        hint="The citizen receives a notification with this remark."
      />
    </Modal>
  );
};

export default RemarkDialog;
