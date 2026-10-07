import { useEffect, useState } from 'react';
import { PencilLine } from 'lucide-react';
import { api } from '@/lib/api';
import { PRIORITY_OPTIONS } from '@/lib/constants';
import { minLength, mobileRule, nameRule } from '@/lib/validation';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import type { Category, ComplaintSummary, FieldErrors, Ward } from '@/types';

interface ComplaintEditDialogProps {
  open: boolean;
  complaint: ComplaintSummary | null;
  categories: Category[];
  wards: Ward[];
  onClose: () => void;
  onSaved: (complaint: ComplaintSummary) => void;
}

/** Administrative edit of the core complaint fields (§14). */
export const ComplaintEditDialog = ({ open, complaint, categories, wards, onClose, onSaved }: ComplaintEditDialogProps) => {
  const [form, setForm] = useState({ categoryId: '', priority: 'medium', wardId: '', location: '', streetName: '', mobileNumber: '', description: '', remarks: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open || !complaint) return;
    setForm({
      categoryId: String(complaint.categoryId ?? ''),
      priority: complaint.priority,
      wardId: complaint.wardId ? String(complaint.wardId) : '',
      location: complaint.location,
      streetName: complaint.streetName,
      mobileNumber: complaint.mobileNumber,
      description: complaint.description,
      remarks: '',
    });
    setErrors({});
  }, [open, complaint]);

  if (!complaint) return null;

  const submit = async () => {
    const nextErrors: FieldErrors = {};
    const descriptionError = minLength('Complaint description', 30)(form.description);
    if (descriptionError) nextErrors.description = descriptionError;
    const streetError = minLength('Street name', 3)(form.streetName);
    if (streetError) nextErrors.streetName = streetError;
    const locationError = minLength('Location', 3)(form.location);
    if (locationError) nextErrors.location = locationError;
    const mobileError = mobileRule(form.mobileNumber);
    if (mobileError) nextErrors.mobileNumber = mobileError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const updated = await api.put<ComplaintSummary>(`/complaints/${complaint.id}`, {
        categoryId: Number(form.categoryId),
        priority: form.priority,
        wardId: form.wardId ? Number(form.wardId) : undefined,
        location: form.location,
        streetName: form.streetName,
        mobileNumber: form.mobileNumber,
        description: form.description,
        remarks: form.remarks.trim() || undefined,
      });
      toast.success('Complaint updated', `${complaint.complaintId} has been updated successfully.`);
      onSaved(updated);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The complaint could not be updated.';
      toast.error('Update failed', message);
      setErrors({ description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit complaint"
      description={`${complaint.complaintId} • registered by ${complaint.citizenName}`}
      icon={<PencilLine className="h-5 w-5" />}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting} touch>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting} touch>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Category"
          required
          value={form.categoryId}
          onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
        />
        <Select
          label="Priority"
          required
          value={form.priority}
          onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
          options={PRIORITY_OPTIONS.filter((option) => option.value !== 'all').map((option) => ({ value: option.value, label: option.label }))}
        />
        <Select
          label="Ward"
          value={form.wardId}
          onChange={(event) => setForm((current) => ({ ...current, wardId: event.target.value }))}
          placeholder="Not linked"
          options={wards.map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` }))}
        />
        <Input
          label="Citizen mobile number"
          required
          value={form.mobileNumber}
          error={errors.mobileNumber}
          inputMode="numeric"
          onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value.replace(/[^\d]/g, '').slice(0, 10) }))}
        />
        <Input
          label="Street name"
          required
          value={form.streetName}
          error={errors.streetName}
          onChange={(event) => setForm((current) => ({ ...current, streetName: event.target.value }))}
        />
        <Input
          label="Location"
          required
          value={form.location}
          error={errors.location}
          onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
        />
        <Textarea
          containerClassName="sm:col-span-2"
          label="Complaint description"
          required
          value={form.description}
          error={errors.description}
          maxLength={2000}
          showCount
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
        />
        <Textarea
          containerClassName="sm:col-span-2"
          label="Add a remark to the history (optional)"
          value={form.remarks}
          maxLength={2000}
          onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
          placeholder="Explain why the complaint is being edited — this is stored in the complaint history."
        />
      </div>
    </Modal>
  );
};

export default ComplaintEditDialog;
