import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FilePlus2, Info, MapPin, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { useAsync } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PRIORITY_META } from '@/lib/constants';
import { categoryIcon } from '@/lib/constants';
import { maxLength, minLength, mobileRule, nameRule, rationRule } from '@/lib/validation';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { Select, Textarea } from '@/components/ui/Input';
import FileUploader from '@/components/ui/FileUploader';
import { Badge } from '@/components/ui/Badge';
import PageHeader from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Category, ComplaintDetail, FieldErrors, Priority, Ward } from '@/types';

interface FormState {
  citizenName: string;
  rationNumber: string;
  mobileNumber: string;
  categoryId: string;
  description: string;
  streetName: string;
  area: string;
  location: string;
  wardId: string;
  priority: Priority | '';
}

const INITIAL: FormState = {
  citizenName: '',
  rationNumber: '',
  mobileNumber: '',
  categoryId: '',
  description: '',
  streetName: '',
  area: '',
  location: '',
  wardId: '',
  priority: '',
};

const MIN_DESCRIPTION = 30;
const MAX_DESCRIPTION = 2000;

/**
 * Complaint registration form (§8) with client-side validation, live ID
 * preview, image upload with preview and location capture.
 */
export const NewComplaintPage = () => {
  const { user, branding } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: categories, loading: categoriesLoading } = useAsync<Category[]>((signal) => api.get<Category[]>('/categories', signal), []);
  const { data: wards } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards', signal), []);

  const [form, setForm] = useState<FormState>({ ...INITIAL, citizenName: user?.role === 'citizen' ? user.name : '', rationNumber: user?.rationNumber ?? '', mobileNumber: user?.mobile ?? '', wardId: user?.wardId ? String(user.wardId) : '' });
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ComplaintDetail | null>(null);

  // Pre-select the category when arriving from the sidebar link.
  useEffect(() => {
    const slug = searchParams.get('category');
    if (slug && categories?.length) {
      const match = categories.find((category) => category.slug === slug);
      if (match) setForm((current) => ({ ...current, categoryId: String(match.id) }));
    }
  }, [categories, searchParams]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const previewId = useMemo(() => {
    const year = new Date().getFullYear();
    return `${branding?.complaintPrefix ?? 'VCMS'}-${year}-??????`;
  }, [branding?.complaintPrefix]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {
      citizenName: nameRule('Citizen name')(form.citizenName) ?? '',
      rationNumber: rationRule(true)(form.rationNumber) ?? '',
      mobileNumber: mobileRule(form.mobileNumber) ?? '',
      categoryId: form.categoryId ? '' : 'Complaint category is required.',
      description: [
        minLength('Complaint description', MIN_DESCRIPTION)(form.description) ?? '',
        maxLength('Complaint description', MAX_DESCRIPTION)(form.description) ?? '',
      ].find(Boolean) ?? '',
      streetName: minLength('Street name', 3)(form.streetName) ?? '',
      location: minLength('Location', 3)(form.location) ?? '',
      priority: form.priority ? '' : 'Priority level is required.',
    };
    if (form.area && form.area.length > 160) next.area = 'Area must not exceed 160 characters.';
    return Object.fromEntries(Object.entries(next).filter(([, value]) => Boolean(value)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.warning('Please review the form', 'Some fields need attention before the complaint can be registered.');
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('citizenName', form.citizenName.trim());
    formData.append('rationNumber', form.rationNumber.trim().toUpperCase());
    formData.append('mobileNumber', form.mobileNumber.trim());
    formData.append('categoryId', form.categoryId);
    formData.append('description', form.description.trim());
    formData.append('streetName', form.streetName.trim());
    if (form.area.trim()) formData.append('area', form.area.trim());
    formData.append('location', form.location.trim());
    if (form.wardId) formData.append('wardId', form.wardId);
    formData.append('priority', form.priority);
    if (image) formData.append('image', image);

    try {
      const complaint = await api.upload<ComplaintDetail>('/complaints', formData);
      setCreated(complaint);
      toast.success('Complaint registered', `Your reference number is ${complaint.complaintId}.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { description: error.message });
        toast.error('Complaint submission failed', error.message);
      } else {
        toast.error('Complaint submission failed', 'Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success screen with the generated reference number ─────────────── */
  if (created) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success-soft text-success">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-bold text-ink sm:text-2xl">Complaint registered successfully</h1>
          <p className="mt-1.5 text-sm text-muted">
            Please note your complaint reference number. You can use it to track the progress at any time.
          </p>

          <div className="mx-auto mt-5 max-w-sm rounded-xl border border-primary/30 bg-primary-soft p-4">
            <p className="text-2xs font-semibold uppercase tracking-wide text-primary">Complaint reference number</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-primary">{created.complaintId}</p>
          </div>

          <dl className="mt-6 grid gap-3 text-left sm:grid-cols-2">
            {[
              ['Category', created.categoryName ?? '—'],
              ['Priority', created.priorityLabel],
              ['Location', created.location],
              ['Registered on', new Date(created.complaintDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
              ['Current status', created.statusLabel],
              ['Ward', created.wardName ?? 'Not linked'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-elevated/50 p-3">
                <dt className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => navigate(`/complaints/${created.id}`)}>
              View complaint details
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/track?complaintId=${created.complaintId}`)}>
              Track status
            </Button>
            <Button
              variant="ghost"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={() => {
                setCreated(null);
                setForm({ ...INITIAL, citizenName: user?.name ?? '', rationNumber: user?.rationNumber ?? '', mobileNumber: user?.mobile ?? '' });
                setImage(null);
              }}
            >
              Register another complaint
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Register a complaint"
        description="Provide accurate details so the village officer can act quickly. The complaint reference number is generated automatically — you do not need to enter it."
      />

      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1.6fr_1fr]" noValidate>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={<FilePlus2 className="h-4 w-4" aria-hidden />} title="Complaint details" subtitle="What is the grievance about?" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="categoryId">
                  Complaint category <span className="text-danger">*</span>
                </label>
                {categoriesLoading ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[0, 1, 2, 3].map((index) => (
                      <Skeleton key={index} className="h-20 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div id="categoryId" role="radiogroup" aria-label="Complaint category" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(categories ?? []).map((category) => {
                      const Icon = categoryIcon(category.icon);
                      const active = form.categoryId === String(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          title={category.description ?? category.name}
                          onClick={() => set('categoryId', String(category.id))}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200',
                            active ? 'border-primary bg-primary-soft shadow-card' : 'border-line bg-surface hover:border-primary/40 hover:bg-elevated',
                          )}
                        >
                          <Icon className="h-5 w-5" style={{ color: category.colour }} aria-hidden />
                          <span className="text-2xs font-medium leading-tight text-ink">{category.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.categoryId && <p className="field-message">{errors.categoryId}</p>}
              </div>

              <Textarea
                containerClassName="sm:col-span-2"
                label="Complaint description"
                required
                value={form.description}
                error={errors.description}
                maxLength={MAX_DESCRIPTION}
                showCount
                onChange={(event) => set('description', event.target.value)}
                placeholder="Describe the issue, when it started and how it is affecting the residents. Minimum 30 characters."
                hint={`Minimum ${MIN_DESCRIPTION} characters. Mention landmarks or how long the issue has existed.`}
              />

              <Select
                label="Priority level"
                required
                value={form.priority}
                error={errors.priority}
                onChange={(event) => set('priority', event.target.value as Priority)}
                placeholder="Select priority"
                options={(['low', 'medium', 'high', 'critical'] as Priority[]).map((priority) => ({
                  value: priority,
                  label: `${PRIORITY_META[priority].label} — ${
                    priority === 'critical'
                      ? 'safety risk / immediate attention'
                      : priority === 'high'
                        ? 'affects many residents'
                        : priority === 'medium'
                          ? 'needs attention soon'
                          : 'minor inconvenience'
                  }`,
                }))}
              />

              <Input
                label="Complaint date"
                value={new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                readOnly
                disabled
                hint="Recorded automatically with the current date and time."
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon={<MapPin className="h-4 w-4" aria-hidden />} title="Citizen information" subtitle="Who is reporting this issue?" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Citizen name"
                required
                value={form.citizenName}
                error={errors.citizenName}
                onChange={(event) => set('citizenName', event.target.value)}
                placeholder="Full name as per records"
              />
              <Input
                label="Ration number"
                required
                value={form.rationNumber}
                error={errors.rationNumber}
                onChange={(event) => set('rationNumber', event.target.value.toUpperCase())}
                placeholder="TN123456789"
                hint="Used to verify the household"
              />
              <Input
                label="Mobile number"
                required
                inputMode="numeric"
                value={form.mobileNumber}
                error={errors.mobileNumber}
                onChange={(event) => set('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 digit mobile number"
                hint="The officer may call you to confirm the location"
              />
              <Input
                label="Complaint ID"
                value={previewId}
                readOnly
                disabled
                hint="Generated automatically by the system"
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon={<MapPin className="h-4 w-4" aria-hidden />} title="Location" subtitle="Where is the issue located?" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Street name"
                required
                value={form.streetName}
                error={errors.streetName}
                onChange={(event) => set('streetName', event.target.value)}
                placeholder="For example: Gandhi Street"
              />
              <Input
                label="Area / colony"
                value={form.area}
                error={errors.area}
                onChange={(event) => set('area', event.target.value)}
                placeholder="For example: Anna Nagar"
              />
              <Input
                containerClassName="sm:col-span-2"
                label="Location description"
                required
                value={form.location}
                error={errors.location}
                onChange={(event) => set('location', event.target.value)}
                placeholder="For example: Ward 4, Gandhi Street, near the primary school"
                hint="Include a landmark so the officer can find the spot easily."
              />
              <Select
                label="Ward"
                value={form.wardId}
                onChange={(event) => set('wardId', event.target.value)}
                placeholder="Select ward (optional)"
                options={(wards ?? []).map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` }))}
                hint="Leave blank to use the ward linked to your profile."
              />
              <div className="rounded-xl border border-dashed border-line bg-elevated/50 p-3 text-2xs text-muted">
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden /> Map pin (coming soon)
                </p>
                <p className="mt-1 leading-relaxed">
                  The location layer already stores latitude and longitude, so GPS based pinning can be enabled without a data
                  migration. GPS is never required to register a complaint.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title="Evidence" subtitle="A photograph helps officers act faster" />
            <FileUploader
              file={image}
              onSelect={setImage}
              error={errors.image}
              maxMb={branding?.maxUploadMb ?? 5}
              hint="Optional but strongly recommended. The image is compressed and stripped of metadata before storage."
            />
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="reset" onClick={() => { setForm({ ...INITIAL, citizenName: user?.name ?? '', rationNumber: user?.rationNumber ?? '', mobileNumber: user?.mobile ?? '' }); setImage(null); setErrors({}); }}>
              Clear form
            </Button>
            <Button type="submit" size="lg" loading={submitting} icon={<Send className="h-4 w-4" />} touch>
              Submit complaint
            </Button>
          </div>
        </div>

        {/* ── Guidance sidebar ────────────────────────────────────────── */}
        <aside className="space-y-5">
          <Card>
            <CardHeader icon={<Info className="h-4 w-4" aria-hidden />} title="Before you submit" />
            <ul className="space-y-3 text-xs text-muted">
              {[
                'Check that the category matches the issue — it decides which officer handles it.',
                'Give a landmark in the location field so the officer can find the spot.',
                'Describe how long the issue has existed and how many households are affected.',
                'Attach a photograph if possible; complaints with evidence are resolved faster.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title="What happens next" />
            <ol className="space-y-3 text-xs">
              {[
                ['Reference number generated', 'You get an ID like VCMS-2026-001245 instantly.'],
                ['Administrator review', 'The complaint is verified and approved.'],
                ['Officer assignment', 'A village officer is assigned and notified.'],
                ['Investigation & resolution', 'You are notified at every change with the officer’s remarks.'],
              ].map(([title, description], index) => (
                <li key={title} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-2xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{title}</span>
                    <span className="block text-muted">{description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="border-primary/25 bg-primary-soft/40">
            <p className="text-xs font-semibold text-ink">Filing a complaint on behalf of a citizen?</p>
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              Administrators can register a complaint for any citizen by entering the citizen’s name, ration number and mobile
              number. The account linked to that ration number is matched automatically.
            </p>
            {user?.role === 'admin' && (
              <p className="mt-2 flex items-center gap-1.5 text-2xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Signed in as an administrator
              </p>
            )}
          </Card>

          <Card>
            <CardHeader icon={<FilePlus2 className="h-4 w-4" aria-hidden />} title="Allowed image formats" />
            <div className="flex flex-wrap gap-2">
              {['JPG', 'JPEG', 'PNG', 'WEBP'].map((format) => (
                <Badge key={format} className="border-line bg-elevated text-muted">
                  {format}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-2xs text-muted">
              Maximum file size {formatNumber(branding?.maxUploadMb ?? 5)} MB. Files are re-encoded to WEBP after validation.
            </p>
          </Card>
        </aside>
      </form>
    </>
  );
};

export default NewComplaintPage;
