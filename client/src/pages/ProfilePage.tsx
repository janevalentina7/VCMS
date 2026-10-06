import { useEffect, useState } from 'react';
import { Camera, KeyRound, Mail, MapPin, Monitor, Phone, Save, ShieldCheck, Trash2, User } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatDate, formatDateTime, formatFileSize } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { ROLE_META } from '@/lib/constants';
import { emailRule, mobileRule, nameRule, passwordRule } from '@/lib/validation';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { Select } from '@/components/ui/Input';
import Avatar from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import FileUploader from '@/components/ui/FileUploader';
import { ConfirmDialog } from '@/components/ui/Modal';
import PageHeader from '@/components/layout/PageHeader';
import type { FieldErrors, Ward } from '@/types';

interface SessionRecord {
  id: number;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
}

const revokeSession = async (session: SessionRecord, reload: () => void, toast: ReturnType<typeof useToast>) => {
  try {
    await api.delete(`/auth/sessions/${session.id}`);
    toast.success('Session revoked');
    reload();
  } catch (err) {
    toast.error('Could not revoke session', err instanceof Error ? err.message : 'Please try again.');
  }
};

/** Profile page: personal details, profile picture, password and active sessions. */
export const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', address: '', wardId: '', rationNumber: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [changing, setChanging] = useState(false);
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);

  const { data: wards = [] } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards', signal), []);
  const { data: sessions, reload: reloadSessions } = useAsync<SessionRecord[]>((signal) => api.get<SessionRecord[]>('/auth/sessions', signal), []);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      address: user.address ?? '',
      wardId: user.wardId ? String(user.wardId) : '',
      rationNumber: user.rationNumber ?? '',
    });
  }, [user]);

  if (!user) return null;

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      name: nameRule('Full name')(form.name) ?? '',
      email: emailRule(form.email) ?? '',
      mobile: mobileRule(form.mobile) ?? '',
    };
    setErrors(Object.fromEntries(Object.entries(nextErrors).filter(([, value]) => Boolean(value))));
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    try {
      await api.put('/users/me/profile', {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim() || null,
        wardId: form.wardId ? Number(form.wardId) : null,
        rationNumber: form.rationNumber.trim() ? form.rationNumber.trim().toUpperCase() : null,
      });
      await refreshUser();
      toast.success('Profile updated', 'Your details have been saved.');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.keys(err.fieldErrors).length ? err.fieldErrors : { email: err.message });
        toast.error('Could not update profile', err.message);
      } else {
        toast.error('Could not update profile', 'Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async () => {
    if (!avatar) return;
    setUploading(true);
    const data = new FormData();
    data.append('avatar', avatar);
    try {
      await api.upload('/users/me/avatar', data);
      await refreshUser();
      setAvatar(null);
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error('Upload failed', err instanceof Error ? err.message : 'Please try another image.');
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      currentPassword: passwords.currentPassword ? '' : 'Enter your current password.',
      newPassword: passwordRule(passwords.newPassword) ?? '',
      confirmPassword: passwords.confirmPassword === passwords.newPassword ? '' : 'New password and confirmation do not match.',
    };
    setPasswordErrors(Object.fromEntries(Object.entries(nextErrors).filter(([, value]) => Boolean(value))));
    if (Object.values(nextErrors).some(Boolean)) return;

    setChanging(true);
    try {
      await api.post('/auth/change-password', passwords);
      toast.success('Password changed', 'For your security you have been signed out of every device. Please sign in again.');
      window.location.href = '/login';
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordErrors(Object.keys(err.fieldErrors).length ? err.fieldErrors : { newPassword: err.message });
        toast.error('Could not change password', err.message);
      } else {
        toast.error('Could not change password', 'Please try again.');
      }
    } finally {
      setChanging(false);
    }
  };

  const signOutAll = async () => {
    try {
      await api.post('/auth/logout-all');
      toast.success('Signed out everywhere', 'All other sessions have been revoked.');
      reloadSessions();
      setConfirmSignOutAll(false);
    } catch {
      toast.error('Action failed', 'Please try again.');
    }
  };

  return (
    <>
      <PageHeader title="My profile" description="Keep your contact details up to date — officers use them to reach you about your complaints." />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader icon={<User className="h-4 w-4" aria-hidden />} title="Personal details" subtitle="Visible to the officer handling your complaint" />
            <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Input label="Full name" required value={form.name} error={errors.name} onChange={(event) => setForm({ ...form, name: event.target.value })} icon={<User className="h-4 w-4" />} />
              <Input
                label="Mobile number"
                required
                inputMode="numeric"
                value={form.mobile}
                error={errors.mobile}
                onChange={(event) => setForm({ ...form, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) })}
                icon={<Phone className="h-4 w-4" />}
              />
              <Input label="Email address" required type="email" value={form.email} error={errors.email} onChange={(event) => setForm({ ...form, email: event.target.value })} icon={<Mail className="h-4 w-4" />} />
              <Input
                label="Ration number"
                value={form.rationNumber}
                onChange={(event) => setForm({ ...form, rationNumber: event.target.value.toUpperCase() })}
                placeholder="TN123456789"
                disabled={user.role !== 'citizen'}
                hint={user.role !== 'citizen' ? 'Ration numbers apply to citizen accounts only.' : undefined}
              />
              <Select
                label="Ward"
                value={form.wardId}
                onChange={(event) => setForm({ ...form, wardId: event.target.value })}
                placeholder="Not linked"
                options={(wards ?? []).map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` }))}
              />
              <Input label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" loading={saving} icon={<Save className="h-4 w-4" />}>
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader icon={<KeyRound className="h-4 w-4" aria-hidden />} title="Change password" subtitle="Use at least 8 characters with letters and numbers" />
            <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-3" noValidate>
              <Input
                label="Current password"
                required
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                error={passwordErrors.currentPassword}
                onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
              />
              <Input
                label="New password"
                required
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                error={passwordErrors.newPassword}
                onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
              />
              <Input
                label="Confirm new password"
                required
                type="password"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                error={passwordErrors.confirmPassword}
                onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })}
              />
              <div className="flex justify-end sm:col-span-3">
                <Button type="submit" loading={changing} icon={<ShieldCheck className="h-4 w-4" />}>
                  Update password
                </Button>
              </div>
            </form>
            <p className="mt-3 text-2xs text-muted">
              Changing your password signs out every active session, including on other devices.
            </p>
          </Card>

          <Card>
            <CardHeader
              icon={<Monitor className="h-4 w-4" aria-hidden />}
              title="Active sessions"
              subtitle="Devices currently signed in to your account"
              action={
                <Button variant="secondary" size="sm" onClick={() => setConfirmSignOutAll(true)} icon={<Trash2 className="h-3.5 w-3.5" />}>
                  Sign out all
                </Button>
              }
            />
            <ul className="space-y-2.5">
              {(sessions ?? []).map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{session.userAgent ?? 'Unknown device'}</p>
                    <p className="text-2xs text-muted">
                      {session.ipAddress ?? 'IP unavailable'} • signed in {formatDateTime(session.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.current && <Badge className="border-success/35 bg-success-soft text-success">This device</Badge>}
                    <span className="text-2xs text-muted">expires {formatDate(session.expiresAt)}</span>
                    {!session.current && (
                      <Button variant="ghost" size="sm" className="px-2 text-danger hover:bg-danger-soft" onClick={() => revokeSession(session, reloadSessions, toast)} aria-label={`Revoke session on ${session.userAgent ?? 'this device'}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {(sessions ?? []).length === 0 && <li className="text-xs text-muted">No active sessions found.</li>}
            </ul>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader icon={<Camera className="h-4 w-4" aria-hidden />} title="Profile picture" subtitle="JPG, PNG or WEBP up to 5 MB" />
            <div className="flex flex-col items-center gap-3">
              <Avatar name={user.name} src={user.avatarUrl} size="lg" />
              <p className="text-center text-xs text-muted">
                {user.name}
                <br />
                <span className="text-2xs">{ROLE_META[user.role].label}</span>
              </p>
              <FileUploader file={avatar} onSelect={setAvatar} label="" hint="" existingUrl={user.avatarUrl} maxMb={5} />
              {avatar && (
                <div className="w-full text-center">
                  <p className="text-2xs text-muted">
                    {avatar.name} • {formatFileSize(avatar.size)}
                  </p>
                  <Button className="mt-2 w-full justify-center" loading={uploading} onClick={uploadAvatar}>
                    Upload picture
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title="Account summary" />
            <dl className="space-y-2.5 text-xs">
              {[
                ['Role', user.roleLabel],
                ['Account status', user.status],
                ['Ward', user.wardName ?? 'Not linked'],
                ['Ration number', user.rationNumber ?? '—'],
                ['Member since', formatDate(user.createdAt)],
                ['Last sign-in', user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'This session'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-line/70 pb-2 last:border-0">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-start gap-2 text-2xs text-muted">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Your ward helps route complaints to the officer responsible for that area.
            </p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmSignOutAll}
        title="Sign out of all devices?"
        tone="danger"
        confirmLabel="Sign out everywhere"
        onCancel={() => setConfirmSignOutAll(false)}
        onConfirm={signOutAll}
        message={<p>Every session except this one will be revoked. You will stay signed in on this device.</p>}
      />
    </>
  );
};

export default ProfilePage;
