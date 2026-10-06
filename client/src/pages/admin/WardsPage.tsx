import { useState } from 'react';
import { Building2, MapPin, PencilLine, Plus } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { Switch } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import type { FieldErrors, Ward } from '@/types';

/** Ward / village division management - drives complaints, officers and analytics. */
export const WardsPage = () => {
  const toast = useToast();
  const { data: wards, loading, error, reload } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards?includeInactive=true&withCounts=true', signal), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ward | null>(null);
  const [form, setForm] = useState({ name: '', code: '', village: '', description: '', active: true });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', village: 'Kattupakkam', description: '', active: true });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (ward: Ward) => {
    setEditing(ward);
    setForm({ name: ward.name, code: ward.code, village: ward.village ?? '', description: ward.description ?? '', active: ward.active });
    setErrors({});
    setFormOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (form.name.trim().length < 2) nextErrors.name = 'Ward name must be at least 2 characters.';
    if (!form.code.trim()) nextErrors.code = 'Ward code is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const payload = { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase(), village: form.village.trim() || null, description: form.description.trim() || null };
      if (editing) {
        await api.put(`/wards/${editing.id}`, payload);
        toast.success('Ward updated', `${payload.name} has been updated.`);
      } else {
        await api.post('/wards', payload);
        toast.success('Ward created', `${payload.name} is now available for complaints.`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.keys(err.fieldErrors).length ? err.fieldErrors : { name: err.message });
        toast.error('Could not save ward', err.message);
      } else {
        toast.error('Could not save ward', 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Wards & divisions"
        description="Wards are used to route complaints to the right officer and to produce ward-wise analytics."
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Add ward
          </Button>
        }
      />

      <Card>
        {loading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (wards ?? []).length === 0 ? (
          <EmptyState title="No wards configured" description="Add wards so complaints can be assigned and analysed by division." />
        ) : (
          <>
            <div className="table-wrap hidden md:block">
              <table className="table">
                <caption className="sr-only">Wards</caption>
                <thead>
                  <tr>
                    <th scope="col">Ward</th>
                    <th scope="col">Code</th>
                    <th scope="col">Village</th>
                    <th scope="col">Officers</th>
                    <th scope="col">Complaints</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(wards ?? []).map((ward) => (
                    <tr key={ward.id}>
                      <td>
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" aria-hidden />
                          <span>
                            <span className="block text-xs font-semibold text-ink">{ward.name}</span>
                            <span className="block text-2xs text-muted">{ward.description ?? '—'}</span>
                          </span>
                        </span>
                      </td>
                      <td className="font-mono text-xs text-muted">{ward.code}</td>
                      <td className="text-xs text-muted">{ward.village ?? '—'}</td>
                      <td className="text-xs font-semibold text-ink">{formatNumber(ward.officerCount ?? 0)}</td>
                      <td className="text-xs font-semibold text-ink">{formatNumber(ward.complaintCount ?? 0)}</td>
                      <td>
                        <Badge className={ward.active ? 'border-success/35 bg-success-soft text-success' : 'border-line bg-elevated text-muted'}>
                          {ward.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(ward)} icon={<PencilLine className="h-3.5 w-3.5" />}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {(wards ?? []).map((ward) => (
                <li key={ward.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{ward.name}</p>
                      <p className="font-mono text-2xs text-muted">{ward.code}</p>
                    </div>
                    <Badge className={ward.active ? 'border-success/35 bg-success-soft text-success' : 'border-line bg-elevated text-muted'}>{ward.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="mt-1 text-2xs text-muted">{ward.description ?? '—'}</p>
                  <div className="mt-2 flex gap-2 text-2xs text-muted">
                    <span>{formatNumber(ward.officerCount ?? 0)} officer(s)</span>
                    <span>•</span>
                    <span>{formatNumber(ward.complaintCount ?? 0)} complaint(s)</span>
                  </div>
                  <Button variant="secondary" size="sm" className="mt-3 w-full justify-center" onClick={() => openEdit(ward)}>
                    Edit ward
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add ward'}
        description="Wards group complaints by village division."
        icon={<Building2 className="h-5 w-5" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={submitting}>
              {editing ? 'Save changes' : 'Create ward'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Input label="Ward name" required value={form.name} error={errors.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ward 7 — Kattupakkam" />
          <Input label="Ward code" required value={form.code} error={errors.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="W07" />
          <Input label="Village" value={form.village} onChange={(event) => setForm({ ...form, village: event.target.value })} />
          <Input label="Coverage description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Streets and colonies covered" />
          <div className="sm:col-span-2">
            <Switch checked={form.active} onChange={(checked) => setForm({ ...form, active: checked })} label="Active" description="Inactive wards cannot receive new complaints." />
          </div>
        </form>
      </Modal>
    </>
  );
};

export default WardsPage;
