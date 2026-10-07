import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CreditCard, Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useAsync } from '@/hooks';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { compose, emailRule, mobileRule, nameRule, passwordRule, rationRule } from '@/lib/validation';
import Button from '@/components/ui/Button';
import Input, { Checkbox, Select } from '@/components/ui/Input';
import Logo from '@/components/layout/Logo';
import type { FieldErrors, Ward } from '@/types';

interface FormState {
  name: string;
  email: string;
  mobile: string;
  rationNumber: string;
  wardId: string;
  address: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
}

const INITIAL: FormState = {
  name: '',
  email: '',
  mobile: '',
  rationNumber: '',
  wardId: '',
  address: '',
  password: '',
  confirmPassword: '',
  consent: false,
};

/** Password strength meter - purely advisory, the rules live in one place. */
const strengthOf = (password: string) => {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  return Math.min(score, 4);
};

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOURS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success'];

export const RegisterPage = () => {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const { data: wards } = useAsync<Ward[]>((signal) => api.get<Ward[]>('/wards', signal), []);
  const strength = strengthOf(form.password);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {
      name: nameRule('Full name')(form.name) ?? '',
      email: emailRule(form.email) ?? '',
      mobile: mobileRule(form.mobile) ?? '',
      rationNumber: rationRule(true)(form.rationNumber) ?? '',
      password: passwordRule(form.password) ?? '',
      confirmPassword: form.confirmPassword === form.password ? '' : 'Password and confirmation password do not match.',
    };
    if (form.address && form.address.length > 255) next.address = 'Address must not exceed 255 characters.';
    if (!form.consent) next.consent = 'Please confirm that the details provided are accurate.';
    return Object.fromEntries(Object.entries(next).filter(([, value]) => Boolean(value)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.warning('Please review the form', 'Some details need your attention before the account can be created.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        rationNumber: form.rationNumber.trim().toUpperCase(),
        wardId: form.wardId ? Number(form.wardId) : null,
        address: form.address.trim() || null,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      toast.success('Account created', `Welcome ${user.name.split(' ')[0]}. You can now register complaints.`);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { email: error.message });
        toast.error('Registration failed', error.message);
      } else {
        toast.error('Registration failed', 'Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
          <Link to="/login" className="btn btn-secondary btn-sm">
            Already registered? Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:py-12">
        <section>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Citizen registration</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Create your account to report village grievances and track their resolution. Fields marked with an asterisk are
            mandatory.
          </p>

          <form onSubmit={submit} className="card card-pad mt-6 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                required
                value={form.name}
                error={errors.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="For example: Arun Kumar"
                icon={<User className="h-4 w-4" />}
              />
              <Input
                label="Ration number"
                required
                value={form.rationNumber}
                error={errors.rationNumber}
                onChange={(event) => set('rationNumber', event.target.value.toUpperCase())}
                placeholder="TN123456789"
                hint="Found on your family ration card"
                icon={<CreditCard className="h-4 w-4" />}
              />
              <Input
                label="Mobile number"
                required
                inputMode="numeric"
                value={form.mobile}
                error={errors.mobile}
                onChange={(event) => set('mobile', event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10 digit mobile number"
                hint="Used for OTP and SMS updates in production"
                icon={<Phone className="h-4 w-4" />}
              />
              <Input
                label="Email address"
                required
                type="email"
                value={form.email}
                error={errors.email}
                onChange={(event) => set('email', event.target.value)}
                placeholder="name@example.com"
                icon={<Mail className="h-4 w-4" />}
              />
              <Select
                label="Ward"
                value={form.wardId}
                onChange={(event) => set('wardId', event.target.value)}
                placeholder="Select your ward (optional)"
                options={(wards ?? []).map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` }))}
                hint="Helps route your complaint to the right officer"
              />
              <Input
                label="Address"
                value={form.address}
                error={errors.address}
                onChange={(event) => set('address', event.target.value)}
                placeholder="Door no, street, village"
                icon={<MapPin className="h-4 w-4" />}
              />
            </div>

            <div className="divider" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label="Password"
                  required
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  error={errors.password}
                  onChange={(event) => set('password', event.target.value)}
                  placeholder="Minimum 8 characters"
                />
                {form.password && (
                  <div className="mt-2">
                    <div className="flex gap-1" aria-hidden>
                      {[0, 1, 2, 3].map((index) => (
                        <span key={index} className={`h-1.5 flex-1 rounded-full ${index < strength ? STRENGTH_COLOURS[strength] : 'bg-line'}`} />
                      ))}
                    </div>
                    <p className="mt-1 text-2xs text-muted">
                      Strength: <span className="font-semibold text-ink">{STRENGTH_LABELS[strength]}</span> — use letters, numbers and a symbol.
                    </p>
                  </div>
                )}
              </div>
              <Input
                label="Confirm password"
                required
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                error={errors.confirmPassword}
                onChange={(event) => set('confirmPassword', event.target.value)}
                placeholder="Re-enter your password"
              />
            </div>

            <div>
              <Checkbox
                label="I confirm that the details provided are accurate and belong to me."
                checked={form.consent}
                onChange={(event) => set('consent', event.target.checked)}
              />
              {errors.consent && <p className="field-message mt-1">{errors.consent}</p>}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" size="lg" loading={submitting} iconRight={<ArrowRight className="h-4 w-4" />} touch>
                Create my account
              </Button>
              <Link to="/login" className="btn btn-ghost btn-lg justify-center">
                I already have an account
              </Link>
            </div>
          </form>
        </section>

        <aside className="space-y-5">
          <div className="card card-pad">
            <h2 className="panel-title">What you can do after registering</h2>
            <ul className="mt-3 space-y-3 text-sm text-muted">
              {[
                'Register unlimited civic complaints with photo evidence',
                'Track progress with a unique reference number',
                'Receive notifications on approval, assignment and resolution',
                'View officer details and resolution remarks',
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="card card-pad">
            <h2 className="panel-title">Your data and privacy</h2>
            <ul className="mt-3 space-y-3 text-sm text-muted">
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Passwords are stored only as bcrypt hashes — never in plain text.
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Your mobile number is shared only with the officer handling your complaint.
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Uploaded photos are validated, compressed and stripped of metadata.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-dashed border-warning/40 bg-warning-soft/60 p-4 text-2xs text-warning">
            This is a demonstration deployment. Please do not submit real personal information — sample data only.
          </div>
        </aside>
      </main>
    </div>
  );
};

export default RegisterPage;
