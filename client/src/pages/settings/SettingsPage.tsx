import { useEffect, useState } from 'react';
import { BellRing, Info, Languages, Lock, Palette, Save, Settings2, ShieldCheck, SlidersHorizontal, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Select, Switch } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonText } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import type { NotificationPreferences, Setting } from '@/types';

const GROUP_META: Record<string, { label: string; description: string; icon: typeof Wrench }> = {
  general: { label: 'General', description: 'Portal identity shown to citizens and officers.', icon: Info },
  workflow: { label: 'Complaint workflow', description: 'Approval, assignment and SLA behaviour.', icon: Wrench },
  notifications: { label: 'Notifications', description: 'Which events raise notifications for staff.', icon: BellRing },
  security: { label: 'Security', description: 'Session and password policy settings.', icon: Lock },
};

const PREFERENCE_LABELS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'complaintNotifications', label: 'Complaint updates', description: 'Registration, approval and status changes for my complaints.' },
  { key: 'assignmentNotifications', label: 'Assignment alerts', description: 'When a complaint is assigned to me or to my ward.' },
  { key: 'resolutionNotifications', label: 'Resolution alerts', description: 'When a complaint is resolved or rejected.' },
  { key: 'emailNotifications', label: 'Email delivery', description: 'Also send these alerts to my email address (when SMTP is configured).' },
  { key: 'smsNotifications', label: 'SMS delivery', description: 'Also send these alerts by SMS (when an SMS gateway is configured).' },
];

/**
 * Settings page.
 *  - every role: appearance, language and personal notification preferences
 *  - administrators additionally get the database-backed application settings (§22)
 */
export const SettingsPage = () => {
  const { user, refreshUser, branding } = useAuth();
  const { mode, setMode } = useTheme();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(user?.preferences ?? null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [language, setLanguage] = useState(user?.preferredLanguage ?? 'en');

  const { data: settingsPayload, loading, error, reload } = useAsync<{ settings: Setting[]; grouped: Record<string, Setting[]> }>(
    (signal) => api.get<{ settings: Setting[]; grouped: Record<string, Setting[]> }>('/settings', signal),
    [],
    { skip: !isAdmin },
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!settingsPayload) return;
    setDrafts(
      Object.fromEntries(settingsPayload.settings.map((entry) => [entry.key, entry.value === null ? '' : String(entry.value)])),
    );
  }, [settingsPayload]);

  useEffect(() => {
    if (user?.preferences) setPreferences(user.preferences);
  }, [user?.preferences]);

  const savePreferences = async () => {
    if (!preferences) return;
    setSavingPreferences(true);
    try {
      await api.put('/users/me/preferences', preferences);
      await api.put('/users/me/profile', { preferredLanguage: language });
      await refreshUser();
      toast.success('Preferences saved', 'Your settings apply to this and future sessions.');
    } catch (err) {
      toast.error('Could not save preferences', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const saveApplicationSettings = async () => {
    setSavingSettings(true);
    try {
      const payload: Record<string, string> = {};
      for (const entry of settingsPayload?.settings ?? []) {
        if (entry.type === 'boolean' || entry.type === 'number') continue;
        payload[entry.key] = drafts[entry.key] ?? '';
      }
      for (const entry of settingsPayload?.settings ?? []) {
        if (entry.type === 'boolean') payload[entry.key] = drafts[entry.key] === 'true' ? 'true' : 'false';
        if (entry.type === 'number') payload[entry.key] = String(Number(drafts[entry.key] ?? 0));
      }
      await api.put('/settings', { settings: payload });
      toast.success('Application settings saved', 'Changes take effect immediately across the portal.');
      reload();
    } catch (err) {
      toast.error('Could not save settings', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  const resetDrafts = () => {
    if (!settingsPayload) return;
    setDrafts(Object.fromEntries(settingsPayload.settings.map((entry) => [entry.key, entry.value === null ? '' : String(entry.value)])));
    toast.info('Changes discarded', 'The form has been restored to the saved values.');
  };

  const grouped = settingsPayload?.grouped ?? {};

  return (
    <>
      <PageHeader
        title="Settings"
        description={isAdmin ? 'Personal preferences and portal-wide configuration.' : 'Personalise how the portal looks and notifies you.'}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader icon={<BellRing className="h-4 w-4" aria-hidden />} title="Notification preferences" subtitle="Choose which updates reach you" />
          {preferences ? (
            <div className="space-y-4">
              {PREFERENCE_LABELS.map(({ key, label, description }) => (
                <Switch
                  key={key}
                  checked={Boolean(preferences[key])}
                  label={label}
                  description={description}
                  onChange={(checked) => setPreferences({ ...preferences, [key]: checked })}
                />
              ))}
              <div className="flex justify-end pt-1">
                <Button loading={savingPreferences} onClick={savePreferences} icon={<Save className="h-4 w-4" />}>
                  Save preferences
                </Button>
              </div>
            </div>
          ) : (
            <SkeletonText lines={5} />
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={<Palette className="h-4 w-4" aria-hidden />} title="Appearance" subtitle="Theme is stored on this device" />
            <Select
              label="Theme"
              value={mode}
              onChange={(event) => setMode(event.target.value as ThemeMode)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'Match system setting' },
              ]}
              hint="Dark mode uses the same government colour palette with reduced brightness for low-light use."
            />
          </Card>

          <Card>
            <CardHeader icon={<Languages className="h-4 w-4" aria-hidden />} title="Language" subtitle="Tamil interface strings are being rolled out" />
            <Select
              label="Preferred language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ta', label: 'தமிழ் (Tamil — beta)' },
              ]}
              hint="Your choice is saved to your account. Complaint text can be written in Tamil or English."
            />
            <div className="mt-3 flex justify-end">
              <Button variant="secondary" loading={savingPreferences} onClick={savePreferences}>
                Save language
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title="Security" subtitle="How your account is protected" />
            <ul className="space-y-2 text-xs text-muted">
              <li className="flex items-start gap-2">
                <Badge className="border-success/35 bg-success-soft text-success">Passwords</Badge>
                Stored only as bcrypt hashes — never in plain text.
              </li>
              <li className="flex items-start gap-2">
                <Badge className="border-success/35 bg-success-soft text-success">Sessions</Badge>
                Short-lived access tokens with rotating refresh tokens that can be revoked from your profile.
              </li>
              <li className="flex items-start gap-2">
                <Badge className="border-success/35 bg-success-soft text-success">Requests</Badge>
                CSRF double-submit protection, rate limiting on sign-in and strict input validation.
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {isAdmin && (
        <Card className="mt-5">
          <CardHeader
            icon={<Settings2 className="h-4 w-4" aria-hidden />}
            title="Application settings"
            subtitle="Database-backed configuration for the whole portal"
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={resetDrafts} disabled={savingSettings}>
                  Discard changes
                </Button>
                <Button loading={savingSettings} onClick={saveApplicationSettings} icon={<Save className="h-4 w-4" />}>
                  Save settings
                </Button>
              </div>
            }
          />

          {loading ? (
            <SkeletonText lines={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (settingsPayload?.settings ?? []).length === 0 ? (
            <EmptyState title="No settings available" description="Run the database seed to populate the default configuration." />
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {Object.entries(grouped).map(([group, entries]) => {
                const meta = GROUP_META[group] ?? { label: group, description: '', icon: SlidersHorizontal };
                const Icon = meta.icon;
                return (
                  <section key={group} className="rounded-xl border border-line p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Icon className="h-4 w-4 text-primary" aria-hidden /> {meta.label}
                    </h3>
                    {meta.description && <p className="mt-0.5 text-2xs text-muted">{meta.description}</p>}
                    <div className="mt-3 space-y-3">
                      {entries.map((entry) =>
                        entry.type === 'boolean' ? (
                          <Switch
                            key={entry.key}
                            checked={(drafts[entry.key] ?? 'false') === 'true'}
                            label={entry.label}
                            description={entry.key}
                            onChange={(checked) => setDrafts({ ...drafts, [entry.key]: checked ? 'true' : 'false' })}
                          />
                        ) : (
                          <label key={entry.key} className="block">
                            <span className="label">{entry.label}</span>
                            <input
                              className="field"
                              type={entry.type === 'number' ? 'number' : 'text'}
                              value={drafts[entry.key] ?? ''}
                              onChange={(event) => setDrafts({ ...drafts, [entry.key]: event.target.value })}
                              aria-label={entry.label}
                            />
                            <span className="field-hint">{entry.key}</span>
                          </label>
                        ),
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <p className="mt-4 flex items-center gap-2 text-2xs text-muted">
            <Info className="h-3.5 w-3.5" aria-hidden />
            Settings are read from the database at runtime — changes apply without restarting the server.
            {settingsPayload?.settings?.[0]?.updatedAt && ` Last saved ${formatDateTime(settingsPayload.settings[0].updatedAt)}.`}
          </p>
          <p className="mt-1 text-2xs text-muted">
            Portal title currently served: <strong className="font-semibold text-ink">{branding?.appName ?? '—'}</strong> • {branding?.organisation ?? ''}
          </p>
        </Card>
      )}
    </>
  );
};

export default SettingsPage;
