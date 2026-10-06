import { useCallback, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Eye, PencilLine, Plus, RefreshCw, Search, UserCog, Users } from 'lucide-react';
import { ApiError, api, buildQuery } from '@/lib/api';
import { exportCsv, formatDate, formatNumber } from '@/lib/utils';
import { useAsync, useDebouncedValue } from '@/hooks';
import { useToast } from '@/context/ToastContext';
import { ROLE_META } from '@/lib/constants';
import { emailRule, mobileRule, nameRule, passwordRule, rationRule } from '@/lib/validation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Pagination from '@/components/ui/Pagination';
import Modal, { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import type { FieldErrors, Pagination as PaginationMeta, Role, User, UserStatus, Ward } from '@/types';

interface UserFormState {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: Role;
  wardId: string;
  rationNumber: string;
  designation: string;
  address: string;
  status: UserStatus;
}

const EMPTY_FORM: UserFormState = {
  name: '',
  email: '',
  mobile: '',
  password: '',
  role: 'citizen',
  wardId: '',
  rationNumber: '',
  designation: '',
  address: '',
  status: 'active',
};

const STATUS_META: Record<UserStatus, string> = {
  active: 'border-success/35 bg-success-soft text-success',
  inactive: 'border-line bg-elevated text-muted',
  suspended: 'border-danger/35 bg-danger-soft text-danger',
};

/** User management (§21): list, create, edit, activate/deactivate and role changes. */
export const UsersPage = () => {
  const toast = useToast();
  const [role, setRole] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [wardId, setWardId] = useState<string>('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const [confirm, setConfirm] = useState<{ user: User; action: 'activate' | 'deactivate' | 'suspend' | 'resetRole' } | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);

  const debouncedTerm = useDebouncedValue(term, 380);
  const query = useMemo(
    () => buildQuery({ q: debouncedTerm, role, status, wardId, page, pageSize, sort: 'newest' }),
    [debouncedTerm, role, status, wardId, page, pageSize],
  );

  const { data: wards = [] } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards?includeInactive=true', signal), []);
  const { data, loading, error, reload } = useAsync<{ items: User[]; pagination: PaginationMeta }>(
    async (signal) => {
      const result = await api.getWithMeta<User[]>(`/users?${query}`, signal);
      return {
        items: result.data ?? [],
        pagination: result.meta?.pagination ?? { page, pageSize, total: result.data?.length ?? 0, totalPages: 1, hasNext: false, hasPrev: false },
      };
    },
    [query, refreshKey],
  );

  const refresh = useCallback(() => {
    reload();
    setRefreshKey((key) => key + 1);
  }, [reload]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      password: '',
      role: user.role,
      wardId: user.wardId ? String(user.wardId) : '',
      rationNumber: user.rationNumber ?? '',
      designation: user.designation ?? '',
      address: user.address ?? '',
      status: user.status,
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {
      name: nameRule('Full name')(form.name) ?? '',
      email: emailRule(form.email) ?? '',
      mobile: mobileRule(form.mobile) ?? '',
      rationNumber: rationRule(form.role === 'citizen')(form.rationNumber) ?? '',
    };
    if (!editing) next.password = passwordRule(form.password) ?? '';
    if (form.role === 'officer' && !form.wardId) next.wardId = 'Select the ward this officer is responsible for.';
    return Object.fromEntries(Object.entries(next).filter(([, value]) => Boolean(value)));
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.warning('Please review the form', 'Some fields need attention.');
      return;
    }

    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim(),
      role: form.role,
      wardId: form.wardId ? Number(form.wardId) : null,
      rationNumber: form.rationNumber ? form.rationNumber.trim().toUpperCase() : null,
      designation: form.designation.trim() || null,
      address: form.address.trim() || null,
      status: form.status,
      ...(!editing && form.password ? { password: form.password } : {}),
    };

    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        toast.success('User updated', `${payload.name}'s account has been updated.`);
      } else {
        await api.post('/users', payload);
        toast.success('User created', `An account has been created for ${payload.name}.`);
      }
      setFormOpen(false);
      refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors;
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { email: err.message });
        toast.error('Could not save user', err.message);
      } else {
        toast.error('Could not save user', 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { user, action } = confirm;
    try {
      if (action === 'activate' || action === 'deactivate' || action === 'suspend') {
        await api.patch(`/users/${user.id}/status`, { status: action === 'activate' ? 'active' : action === 'suspend' ? 'suspended' : 'inactive' });
        toast.success('Account updated', `${user.name}'s account is now ${action === 'activate' ? 'active' : action === 'suspend' ? 'suspended' : 'inactive'}.`);
      }
      refresh();
    } catch (err) {
      toast.error('Action failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setConfirm(null);
    }
  };

  const users = data?.items ?? [];
  const pagination = data?.pagination ?? { page, pageSize, total: 0, totalPages: 1, hasNext: false, hasPrev: false };

  return (
    <>
      <PageHeader
        title="User management"
        description="Manage citizens, village officers and administrators. Roles control what each person can see and do."
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={refresh}>
              Refresh
            </Button>
            <Button
              variant="secondary"
              icon={<Users className="h-4 w-4" />}
              onClick={() => exportCsv(users.map((user) => ({ 'User ID': user.id, Name: user.name, Mobile: user.mobile, Email: user.email, Role: user.roleLabel, Ward: user.wardName ?? '', Status: user.status, 'Created Date': user.createdAt?.slice(0, 10) ?? '' })), 'VCMS-users.csv')}
            >
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add user
            </Button>
          </>
        }
      />

      <Card>
        <div className="grid gap-3 lg:grid-cols-4">
          <Input
            label="Search users"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Name, email, mobile, ration number or ward"
            icon={<Search className="h-4 w-4" />}
          />
          <Select
            label="Role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All roles' },
              { value: 'citizen', label: 'Citizens' },
              { value: 'officer', label: 'Village Officers' },
              { value: 'admin', label: 'Administrators' },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
          <Select
            label="Ward"
            value={wardId}
            onChange={(event) => {
              setWardId(event.target.value);
              setPage(1);
            }}
            placeholder="All wards"
            options={(wards ?? []).map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` }))}
          />
        </div>

        <div className="mt-4">
          {loading ? (
            <SkeletonTable rows={8} columns={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : users.length === 0 ? (
            <EmptyState title="No users found" description="No accounts match the current search and filters." />
          ) : (
            <>
              {/* Desktop table */}
              <div className="table-wrap hidden lg:block">
                <table className="table">
                  <caption className="sr-only">Portal users</caption>
                  <thead>
                    <tr>
                      <th scope="col">User ID</th>
                      <th scope="col">Name</th>
                      <th scope="col">Mobile</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Ward</th>
                      <th scope="col">Status</th>
                      <th scope="col">Created</th>
                      <th scope="col" className="text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="font-mono text-xs text-muted">USR-{String(user.id).padStart(5, '0')}</td>
                        <td>
                          <span className="flex items-center gap-2">
                            <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                            <span className="text-xs font-medium text-ink">{user.name}</span>
                          </span>
                        </td>
                        <td className="text-xs text-muted">{user.mobile}</td>
                        <td className="max-w-[190px] truncate text-xs text-muted" title={user.email}>
                          {user.email}
                        </td>
                        <td>
                          <Badge className={ROLE_META[user.role].className}>{user.roleLabel}</Badge>
                        </td>
                        <td className="text-xs text-muted">{user.wardName?.replace(/ —.*/, '') ?? '—'}</td>
                        <td>
                          <Badge className={STATUS_META[user.status]}>{user.status}</Badge>
                        </td>
                        <td className="whitespace-nowrap text-xs text-muted">{formatDate(user.createdAt)}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="px-2" onClick={() => setViewing(user)} aria-label={`View ${user.name}`}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="px-2" onClick={() => openEdit(user)} aria-label={`Edit ${user.name}`}>
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                            {user.status === 'active' ? (
                              <Button variant="ghost" size="sm" className="px-2 text-danger hover:bg-danger-soft" onClick={() => setConfirm({ user, action: 'deactivate' })} aria-label={`Deactivate ${user.name}`}>
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="px-2 text-success hover:bg-success-soft" onClick={() => setConfirm({ user, action: 'activate' })} aria-label={`Activate ${user.name}`}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="space-y-3 lg:hidden">
                {users.map((user) => (
                  <li key={user.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-start gap-3">
                      <Avatar name={user.name} src={user.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                        <p className="truncate text-2xs text-muted">
                          USR-{String(user.id).padStart(5, '0')} • {user.email}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge className={ROLE_META[user.role].className}>{user.roleLabel}</Badge>
                          <Badge className={STATUS_META[user.status]}>{user.status}</Badge>
                          {user.wardName && <Badge className="border-line bg-elevated text-muted">{user.wardName.replace(/ —.*/, '')}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => setViewing(user)}>
                        View
                      </Button>
                      <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={() => openEdit(user)}>
                        Edit
                      </Button>
                      <Button
                        variant={user.status === 'active' ? 'danger' : 'success'}
                        size="sm"
                        className="flex-1 justify-center"
                        onClick={() => setConfirm({ user, action: user.status === 'active' ? 'deactivate' : 'activate' })}
                      >
                        {user.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {users.length > 0 && (
          <Pagination
            meta={pagination}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            itemLabel="users"
          />
        )}
      </Card>

      {/* ── Create / edit user ─────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add a new user'}
        description={editing ? 'Update account details, role or status.' : 'Create a citizen, village officer or administrator account.'}
        icon={<UserCog className="h-5 w-5" />}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitForm} loading={submitting}>
              {editing ? 'Save changes' : 'Create user'}
            </Button>
          </>
        }
      >
        <form onSubmit={submitForm} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Input label="Full name" required value={form.name} error={errors.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label="Email address" required type="email" value={form.email} error={errors.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input
            label="Mobile number"
            required
            inputMode="numeric"
            value={form.mobile}
            error={errors.mobile}
            onChange={(event) => setForm({ ...form, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) })}
          />
          {!editing && (
            <Input
              label="Initial password"
              required
              type="password"
              autoComplete="new-password"
              value={form.password}
              error={errors.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              hint="Minimum 8 characters, including at least one letter and one number. Never stored in plain text."
            />
          )}
          <Select
            label="Role"
            required
            value={form.role}
            error={errors.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
            options={[
              { value: 'citizen', label: 'Citizen' },
              { value: 'officer', label: 'Village Officer' },
              { value: 'admin', label: 'Administrator' },
            ]}
            hint={editing ? 'You cannot change your own role.' : undefined}
          />
          <Select
            label="Ward"
            value={form.wardId}
            error={errors.wardId}
            onChange={(event) => setForm({ ...form, wardId: event.target.value })}
            placeholder="Not linked"
            options={(wards ?? []).map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` }))}
          />
          {form.role === 'citizen' && (
            <Input
              label="Ration number"
              value={form.rationNumber}
              error={errors.rationNumber}
              onChange={(event) => setForm({ ...form, rationNumber: event.target.value.toUpperCase() })}
              placeholder="TN123456789"
            />
          )}
          {form.role !== 'citizen' && (
            <Input label="Designation" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} placeholder="For example: Assistant Engineer - Works" />
          )}
          <Input label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} containerClassName="sm:col-span-2" />
          <Select
            label="Account status"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as UserStatus })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'suspended', label: 'Suspended' },
            ]}
            containerClassName="sm:col-span-2"
          />
        </form>
      </Modal>

      {/* ── View user ─────────────────────────────────────────────────── */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.name ?? ''} description={viewing?.designation ?? viewing?.roleLabel} icon={<Eye className="h-5 w-5" />}>
        {viewing && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ['User ID', `USR-${String(viewing.id).padStart(5, '0')}`],
              ['Role', viewing.roleLabel],
              ['Email', viewing.email],
              ['Mobile', viewing.mobile],
              ['Ration number', viewing.rationNumber ?? '—'],
              ['Ward', viewing.wardName ?? '—'],
              ['Status', viewing.status],
              ['Created', formatDate(viewing.createdAt)],
              ['Last sign-in', viewing.lastLoginAt ? formatDate(viewing.lastLoginAt, { hour: '2-digit', minute: '2-digit' }) : 'Never'],
              ['Complaints', viewing.complaintCount !== undefined ? formatNumber(viewing.complaintCount) : '—'],
              ['Active assignments', viewing.activeAssignments !== undefined ? formatNumber(viewing.activeAssignments) : '—'],
              ['Address', viewing.address ?? '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-line bg-elevated/50 p-3">
                <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                <dd className="mt-0.5 break-words text-sm font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'activate' ? 'Activate this account?' : 'Deactivate this account?'}
        tone={confirm?.action === 'activate' ? 'success' : 'danger'}
        confirmLabel={confirm?.action === 'activate' ? 'Activate' : 'Deactivate'}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
        message={
          confirm && (
            <p>
              {confirm.action === 'activate'
                ? `${confirm.user.name} will be able to sign in and use the portal again.`
                : `${confirm.user.name} will not be able to sign in. Existing complaint history is preserved. The last active administrator cannot be deactivated.`}
            </p>
          )
        }
      />
    </>
  );
};

export default UsersPage;
