import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CATEGORY_FALLBACK, categoryIcon } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Logo from '@/components/layout/Logo';
import type { PublicStats } from '@/types';

const STEPS = [
  { icon: UserPlus, title: 'Register', description: 'Create a citizen account with your mobile number, email and ration number.' },
  { icon: ClipboardList, title: 'Submit Complaint', description: 'Choose a category, describe the issue, add a photo and pin the location.' },
  { icon: FileSearch, title: 'Track Status', description: 'Follow every stage from approval to officer assignment using your complaint ID.' },
  { icon: CheckCircle2, title: 'Get Resolution', description: 'Receive the officer’s resolution remarks and a notification once the issue is closed.' },
];

const FEATURES = [
  { icon: ClipboardList, title: 'Digital complaint register', description: 'Every grievance gets a unique reference number such as VCMS-2026-001245 with a full audit trail.' },
  { icon: Bell, title: 'Real-time notifications', description: 'Citizens and officers are notified at every stage — registration, approval, assignment and resolution.' },
  { icon: ShieldCheck, title: 'Role based access', description: 'Citizens, village officers and administrators each see exactly what they are permitted to.' },
  { icon: BarChart3, title: 'Analytics & reports', description: 'Category, ward and monthly insights with exportable PDF reports for administrative review.' },
  { icon: MapPin, title: 'Location aware', description: 'Street, area and ward capture with an optional map pin — GPS ready for future releases.' },
  { icon: Lock, title: 'Secure by design', description: 'Hashed passwords, revocable sessions, CSRF protection, rate limiting and validated uploads.' },
];

export const LandingPage = () => {
  const { user, branding } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    api
      .get<PublicStats>('/public/stats')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const heroStats = [
    { label: 'Complaints registered', value: stats ? formatNumber(stats.totalComplaints) : '—', icon: ClipboardList },
    { label: 'Resolved', value: stats ? formatNumber(stats.resolved) : '—', icon: CheckCircle2 },
    { label: 'Resolution rate', value: stats ? `${stats.resolutionRate}%` : '—', icon: TrendingUp },
    { label: 'Registered citizens', value: stats ? formatNumber(stats.citizens) : '—', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Government style top strip ─────────────────────────────────── */}
      <div className="bg-primary-dark text-primary-fg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-2xs sm:px-6">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {branding?.organisation ?? 'Government of Tamil Nadu'} • {branding?.tagline ?? 'Digital Grievance Redressal Portal'}
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 sm:flex">
              <Phone className="h-3.5 w-3.5" aria-hidden /> Helpline: 1800-425-0000
            </span>
            <span className="text-primary-fg/70">Demonstration build — not an official government service</span>
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted lg:flex" aria-label="Landing page sections">
            <a href="#features" className="transition-colors hover:text-ink">Features</a>
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <a href="#categories" className="transition-colors hover:text-ink">Categories</a>
            <a href="#impact" className="transition-colors hover:text-ink">Impact</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary btn-sm">
                Go to dashboard <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary btn-sm">
                  Sign in
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-primary-soft/70 to-canvas">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:py-20">
          <div className="animate-fade-in-up">
            <span className="badge border-primary/25 bg-surface text-primary shadow-card">
              <Sparkles className="h-3 w-3" aria-hidden />
              Digital village governance initiative
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[42px]">
              Report. Track. Resolve.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              A single window for village grievances. Register civic complaints with photo evidence, follow every stage of the
              resolution process, and hold the administration accountable — from any device, in minutes.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to={user ? '/complaints/new' : '/register'} className="btn btn-primary btn-lg">
                Register a complaint <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/track" className="btn btn-secondary btn-lg">
                <FileSearch className="h-4 w-4" aria-hidden /> Track complaint status
              </Link>
            </div>

            <dl className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {heroStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl border border-line bg-surface/80 p-3 shadow-card">
                    <dt className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
                      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                      {stat.label}
                    </dt>
                    <dd className="mt-1 text-xl font-bold text-ink">{stat.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>

          {/* Illustrative "complaint card" mock */}
          <div className="relative animate-fade-in-up lg:justify-self-end">
            <div className="card overflow-hidden shadow-raised">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-primary px-4 py-3 text-primary-fg">
                <span className="font-mono text-xs font-semibold">VCMS-2026-001245</span>
                <span className="badge border-white/30 bg-white/15 text-white">In Progress</span>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-warning-soft text-warning">
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Street Light Problems</p>
                    <p className="text-2xs text-muted">Ward 4, Gandhi Street • High priority</p>
                  </div>
                </div>
                <p className="rounded-lg bg-elevated p-3 text-xs leading-relaxed text-muted">
                  “The street light near the primary school has not been working for the past five days.”
                </p>
                <ol className="space-y-2 text-xs">
                  {[
                    ['Complaint Registered', '12 Feb, 10:24 AM'],
                    ['Complaint Approved', '12 Feb, 4:10 PM'],
                    ['Officer Assigned — Raj Kumar', '13 Feb, 9:05 AM'],
                    ['Investigation Started', '13 Feb, 11:40 AM'],
                  ].map(([label, time], index) => (
                    <li key={label} className="flex items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-success-soft text-success">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                      </span>
                      <span className="flex-1 font-medium text-ink">{label}</span>
                      <span className="text-2xs text-muted">{time}</span>
                      {index < 0 && null}
                    </li>
                  ))}
                </ol>
                <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-2.5 text-2xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> SMS + in-app alerts
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" aria-hidden /> Mobile friendly
                  </span>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-6 -left-6 hidden h-28 w-28 rounded-full bg-primary/10 blur-2xl lg:block" aria-hidden />
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
        <div className="max-w-2xl">
          <p className="text-2xs font-bold uppercase tracking-[0.18em] text-primary">Why this portal</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Built for transparent village administration</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Every complaint is time-stamped, attributed and traceable. Officers get a clean worklist, administrators get
            analytics, and citizens get visibility they never had before.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="card card-hover card-pad group">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary transition-transform duration-300 group-hover:-rotate-3">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3 text-base font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section id="how" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-2xs font-bold uppercase tracking-[0.18em] text-primary">How it works</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Four steps from grievance to resolution</h2>
          </div>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative card card-pad">
                  <span className="absolute right-4 top-4 text-3xl font-black text-line/70" aria-hidden>
                    {index + 1}
                  </span>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-fg">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{step.description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────────────── */}
      <section id="categories" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <p className="text-2xs font-bold uppercase tracking-[0.18em] text-primary">Complaint categories</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">What you can report</h2>
            <p className="mt-3 text-sm text-muted">
              Categories are maintained by the village administration, so the portal always reflects current responsibilities.
            </p>
          </div>
          <Link to="/register" className="btn btn-secondary">
            Start reporting <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_FALLBACK.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <li key={category.slug} className="card card-hover flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${category.colour}1a`, color: category.colour }}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-ink">{category.name}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Benefits / impact ──────────────────────────────────────────── */}
      <section id="impact" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-16">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.18em] text-primary">Benefits</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Accountability that citizens can see</h2>
            <ul className="mt-6 space-y-4">
              {[
                ['No queue, no paperwork', 'Citizens register a grievance in under two minutes with photo evidence.'],
                ['Clear ownership', 'Each complaint is assigned to a named officer with a timestamped history.'],
                ['Measured performance', 'Resolution rate, average resolution time and ward-wise distribution are always visible.'],
                ['Evidence based action', 'Uploaded photographs and location details help officers act correctly the first time.'],
              ].map(([title, description]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="block text-sm text-muted">{description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Average resolution time', value: '6–8 days', hint: 'Target SLA configured by the administration' },
              { label: 'Complaint categories', value: stats ? String(stats.categories) : '8', hint: 'Maintained in the database' },
              { label: 'Ward coverage', value: '6 wards', hint: 'Ward-wise analytics for every complaint' },
              { label: 'Notification channels', value: 'In-app + SMS', hint: 'Email/SMS ready for production credentials' },
            ].map((item) => (
              <div key={item.label} className="card card-pad">
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{item.value}</p>
                <p className="mt-1 text-2xs text-muted">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="overflow-hidden rounded-card border border-primary/25 bg-primary px-6 py-10 text-center shadow-raised sm:px-10">
          <h2 className="text-2xl font-bold tracking-tight text-primary-fg sm:text-3xl">Raise your voice for a better village</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-primary-fg/85">
            Register once and report civic issues any time. Your complaint reaches the right officer with a reference number you
            can always track.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to={user ? '/dashboard' : '/register'} className="btn btn-lg bg-white text-primary hover:bg-white/90">
              {user ? 'Open my dashboard' : 'Create citizen account'}
            </Link>
            <Link to="/login" className="btn btn-lg border-white/40 bg-transparent text-primary-fg hover:bg-white/10">
              Sign in to continue
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-md text-xs leading-relaxed text-muted">
              The Village Complaint Management System is a digital grievance redressal initiative for village panchayats. This
              deployment is a demonstration build created for evaluation purposes and is not affiliated with, endorsed by, or an
              official service of the Government of Tamil Nadu.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink">Quick links</p>
            <ul className="mt-3 space-y-2 text-xs text-muted">
              <li><Link to="/login" className="hover:text-ink">Sign in</Link></li>
              <li><Link to="/register" className="hover:text-ink">Citizen registration</Link></li>
              <li><Link to="/track" className="hover:text-ink">Track complaint status</Link></li>
              <li><a href="#categories" className="hover:text-ink">Complaint categories</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink">Contact</p>
            <ul className="mt-3 space-y-2 text-xs text-muted">
              <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" aria-hidden /> Helpline 1800-425-0000</li>
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" aria-hidden /> Kattupakkam Village Panchayat</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Mon–Sat, 9:30 AM – 5:30 PM</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line px-4 py-4 text-center text-2xs text-muted sm:px-6">
          © {new Date().getFullYear()} Village Complaint Management System — Demonstration build for evaluation. All data shown is
          sample data.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
