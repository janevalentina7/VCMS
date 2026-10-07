import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Button from '@/components/ui/Button';
import Input, { Checkbox } from '@/components/ui/Input';
import Logo from '@/components/layout/Logo';
import type { FieldErrors, Role } from '@/types';

const DEMO_ACCOUNTS: { role: Role; label: string; identifier: string; password: string }[] = [
  { role: 'admin', label: 'Administrator', identifier: 'admin@vcms.gov.in', password: 'Admin@12345' },
  { role: 'officer', label: 'Village Officer', identifier: 'raj.kumar@vcms.gov.in', password: 'Officer@12345' },
  { role: 'citizen', label: 'Citizen', identifier: 'arun.kumar@example.com', password: 'Citizen@12345' },
];

const DASHBOARD_BY_ROLE: Record<Role, string> = { admin: '/dashboard', officer: '/dashboard', citizen: '/dashboard' };

export const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!identifier.trim()) nextErrors.identifier = 'Enter your email address, mobile number or ration number.';
    if (!password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const user = await login(identifier.trim(), password, remember);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`, 'You are now signed in to the grievance portal.');
      navigate(redirectTo ?? DASHBOARD_BY_ROLE[user.role], { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors;
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { password: error.message });
        toast.error('Sign in failed', error.message);
      } else {
        toast.error('Sign in failed', 'Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const useDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setIdentifier(account.identifier);
    setPassword(account.password);
    setErrors({});
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── Brand panel ─────────────────────────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-fg lg:flex">
        <div className="relative z-10">
          <Logo tone="light" />
          <h1 className="mt-14 max-w-md text-3xl font-bold leading-tight">
            Digital grievance redressal for every village household.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-primary-fg/85">
            Sign in to register complaints, follow their progress and review resolution remarks — securely, from any device.
          </p>

          <ul className="mt-10 space-y-4 text-sm">
            {[
              'Unique reference number for every complaint',
              'Live status timeline with officer details',
              'Notifications at every stage of resolution',
              'Analytics and PDF reports for administrators',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary-fg/90" aria-hidden />
                <span className="text-primary-fg/90">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-2xs text-primary-fg/70">
          Demonstration build for evaluation purposes. Not an official Government of Tamil Nadu service.
        </p>
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
      </div>

      {/* ── Form panel ─────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden">
            <Logo />
          </div>

          <h2 className="mt-6 text-2xl font-bold tracking-tight text-ink lg:mt-0">Sign in to the portal</h2>
          <p className="mt-1.5 text-sm text-muted">
            Use your registered email address, mobile number or ration number.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <Input
              label="Email / mobile / ration number"
              required
              autoComplete="username"
              value={identifier}
              error={errors.identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="admin@vcms.gov.in or 9876543210"
              icon={<User className="h-4 w-4" />}
            />

            <div className="relative">
              <Input
                label="Password"
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                error={errors.password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                icon={<Lock className="h-4 w-4" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-[38px] rounded-md p-1 text-muted transition-colors hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Checkbox label="Keep me signed in" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span className="text-2xs text-muted">Forgot password? Contact the village office.</span>
            </div>

            <Button type="submit" block size="lg" loading={submitting} iconRight={<ArrowRight className="h-4 w-4" />}>
              Sign in securely
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            New citizen?{' '}
            <Link to="/register" className="link">
              Create an account
            </Link>
          </p>

          <div className="mt-8 rounded-xl border border-dashed border-line bg-elevated/50 p-4">
            <p className="text-2xs font-bold uppercase tracking-wide text-muted">Development demo credentials</p>
            <p className="mt-1 text-2xs text-muted">
              Seeded sample accounts — click to fill the form. Never use these credentials in production.
            </p>
            <div className="mt-3 grid gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => useDemo(account)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary-soft/50"
                >
                  <span>
                    <span className="block font-semibold text-ink">{account.label}</span>
                    <span className="block text-2xs text-muted">{account.identifier}</span>
                  </span>
                  <span className="font-mono text-2xs text-muted">{account.password}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-2xs text-muted">
            <Link to="/" className="hover:text-ink">
              ← Back to portal home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
