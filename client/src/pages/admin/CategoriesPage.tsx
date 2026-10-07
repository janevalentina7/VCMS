import { useState } from 'react';
import { CircleAlert, PencilLine, Plus, Power, Search, Tags, Trash2 } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { CATEGORY_ICONS, categoryIcon } from '@/lib/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { Select, Switch } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import type { Category, FieldErrors } from '@/types';

const ICON_OPTIONS = Object.keys(CATEGORY_ICONS);

/** Category management (§10): create, edit, activate/deactivate and delete. */
export const CategoriesPage = () => {
  const toast = useToast();
  const { data: categories, loading, error, reload } = useAsync<Category[]>(
    (signal) => api.get<Category[]>('/categories?includeInactive=true&withCounts=true', signal),
    [],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '', icon: 'Tags', colour: '#1d4ed8', active: true, sortOrder: 99 });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState<{ category: Category; action: 'toggle' | 'delete' } | null>(null);
  const [term, setTerm] = useState('');

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', icon: 'Tags', colour: '#1d4ed8', active: true, sortOrder: (categories?.length ?? 0) + 1 });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? '',
      icon: category.icon,
      colour: category.colour,
      active: category.active,
      sortOrder: category.sortOrder,
    });
    setErrors({});
    setFormOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (form.name.trim().length < 3) nextErrors.name = 'Category name must be at least 3 characters.';
    if (!/^#[0-9a-fA-F]{6}$/.test(form.colour)) nextErrors.colour = 'Choose a valid hex colour such as #1d4ed8.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    const payload = { ...form, name: form.name.trim(), description: form.description.trim() || null };
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, payload);
        toast.success('Category updated', `"${payload.name}" has been updated.`);
      } else {
        await api.post('/categories', payload);
        toast.success('Category created', `"${payload.name}" is now available for new complaints.`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.keys(err.fieldErrors).length ? err.fieldErrors : { name: err.message });
        toast.error('Could not save category', err.message);
      } else {
        toast.error('Could not save category', 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { category, action } = confirm;
    try {
      if (action === 'toggle') {
        await api.patch(`/categories/${category.id}/status`, { active: !category.active });
        toast.success(category.active ? 'Category deactivated' : 'Category activated', `"${category.name}" is now ${category.active ? 'hidden from the complaint form' : 'available for new complaints'}.`);
      } else {
        await api.delete(`/categories/${category.id}`);
        toast.success('Category deleted', `"${category.name}" has been removed.`);
      }
      reload();
    } catch (err) {
      toast.error('Action failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setConfirm(null);
    }
  };

  const filtered = (categories ?? []).filter((category) => category.name.toLowerCase().includes(term.trim().toLowerCase()));
  const activeCount = (categories ?? []).filter((category) => category.active).length;

  return (
    <>
      <PageHeader
        title="Complaint categories"
        description="Categories are stored in the database and drive the complaint form, analytics and officer routing. Deactivate a category to stop new complaints without losing history."
        actions={
          <>
            <span className="hidden text-xs text-muted sm:inline">
              {formatNumber(activeCount)} active of {formatNumber(categories?.length ?? 0)}
            </span>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add category
            </Button>
          </>
        }
      />

      <Card>
        <Input
          label="Search categories"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by category name"
          icon={<Search className="h-4 w-4" />}
          containerClassName="max-w-md"
        />

        <div className="mt-4">
          {loading ? (
            <SkeletonTable rows={6} columns={4} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No categories found" description="Create a category so citizens can classify their grievances." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Complaint categories</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Description</th>
                    <th scope="col">Complaints</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                    <th scope="col" className="text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((category) => {
                    const Icon = categoryIcon(category.icon);
                    return (
                      <tr key={category.id}>
                        <td>
                          <span className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: `${category.colour}1a`, color: category.colour }}>
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <span>
                              <span className="block text-xs font-semibold text-ink">{category.name}</span>
                              <span className="block font-mono text-2xs text-muted">{category.slug}</span>
                            </span>
                          </span>
                        </td>
                        <td className="max-w-[280px] text-xs text-muted">{category.description ?? '—'}</td>
                        <td className="text-xs font-semibold text-ink">{formatNumber(category.complaintCount ?? 0)}</td>
                        <td>
                          <Badge className={category.active ? 'border-success/35 bg-success-soft text-success' : 'border-line bg-elevated text-muted'}>
                            {category.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap text-xs text-muted">{formatDate(category.createdAt)}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="px-2" onClick={() => openEdit(category)} aria-label={`Edit ${category.name}`}>
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`px-2 ${category.active ? 'text-warning hover:bg-warning-soft' : 'text-success hover:bg-success-soft'}`}
                              onClick={() => setConfirm({ category, action: 'toggle' })}
                              aria-label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2 text-danger hover:bg-danger-soft"
                              onClick={() => setConfirm({ category, action: 'delete' })}
                              aria-label={`Delete ${category.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add complaint category'}
        description="Categories appear on the complaint form and in analytics."
        icon={<Tags className="h-5 w-5" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={submitting}>
              {editing ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Input label="Category name" required value={form.name} error={errors.name} onChange={(event) => setForm({ ...form, name: event.target.value })} containerClassName="sm:col-span-2" placeholder="For example: Water Supply Issues" />
          <Input
            label="Description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            containerClassName="sm:col-span-2"
            placeholder="Short explanation shown to citizens"
          />
          <Select
            label="Icon"
            value={form.icon}
            onChange={(event) => setForm({ ...form, icon: event.target.value })}
            options={ICON_OPTIONS.map((icon) => ({ value: icon, label: icon }))}
          />
          <div>
            <label className="label" htmlFor="category-colour">
              Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                id="category-colour"
                type="color"
                value={form.colour}
                onChange={(event) => setForm({ ...form, colour: event.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1"
                aria-label="Category colour"
              />
              <Input value={form.colour} error={errors.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} containerClassName="flex-1" />
            </div>
          </div>
          <Input
            label="Sort order"
            type="number"
            min={0}
            max={999}
            value={form.sortOrder}
            onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
          />
          <div className="flex items-end pb-1">
            <Switch checked={form.active} onChange={(checked) => setForm({ ...form, active: checked })} label="Active" description="Shown on the complaint form" />
          </div>

          <div className="rounded-lg border border-line bg-elevated/50 p-3 sm:col-span-2">
            <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
              <CircleAlert className="h-3.5 w-3.5" aria-hidden /> Preview
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: `${form.colour}1a`, color: form.colour }}>
                {(() => {
                  const Icon = categoryIcon(form.icon);
                  return <Icon className="h-4 w-4" aria-hidden />;
                })()}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{form.name || 'Category name'}</span>
                <span className="block text-2xs text-muted">{form.description || 'Description shown to citizens'}</span>
              </span>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'delete' ? 'Delete this category?' : confirm?.category.active ? 'Deactivate this category?' : 'Activate this category?'}
        tone={confirm?.action === 'delete' || confirm?.category.active ? 'danger' : 'success'}
        confirmLabel={confirm?.action === 'delete' ? 'Delete category' : confirm?.category.active ? 'Deactivate' : 'Activate'}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
        message={
          confirm && (
            <p>
              {confirm.action === 'delete'
                ? `"${confirm.category.name}" will be deleted. Categories already used by complaints cannot be deleted — deactivate them instead to preserve history.`
                : confirm.category.active
                  ? `"${confirm.category.name}" will be hidden from the complaint form. Existing complaints keep their category.`
                  : `"${confirm.category.name}" will be available again for new complaints.`}
            </p>
          )
        }
      />
    </>
  );
};

export default CategoriesPage;
