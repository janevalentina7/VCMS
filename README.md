# VCMS — Village Complaint Management System

**Report. Track. Resolve.**

A production-shaped **e-governance grievance redressal portal** for village administrations:
citizens register civic complaints, village officers work them to resolution, and administrators
oversee the whole workflow with live analytics and exportable (PDF) reports.

The interface follows a Tamil Nadu government visual language — deep blue, white, restrained red
accents, the **"Government of Tamil Nadu"** masthead and the **"Digital Grievance Redressal
Portal"** subtitle.

> **Disclaimer** — this is an independent software project built for demonstration and educational
> purposes. It is **not** an official Government of Tamil Nadu application and does not claim any
> affiliation with, or endorsement by, the Government.

---

## Table of contents

1. [Feature overview](#1-feature-overview)
2. [Roles & permissions](#2-roles--permissions)
3. [Complaint lifecycle](#3-complaint-lifecycle)
4. [Technology stack](#4-technology-stack)
5. [Repository layout](#5-repository-layout)
6. [Quick start](#6-quick-start)
7. [Environment variables](#7-environment-variables)
8. [Database, migrations & seed data](#8-database-migrations--seed-data)
9. [Development credentials](#9-development-credentials)
10. [Scripts reference](#10-scripts-reference)
11. [REST API](#11-rest-api)
12. [Security controls](#12-security-controls)
13. [UI, accessibility & theming](#13-ui-accessibility--theming)
14. [Testing](#14-testing)
15. [Verification checklist](#15-verification-checklist)
16. [Production deployment](#16-production-deployment)
17. [Extensibility roadmap](#17-extensibility-roadmap)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Feature overview

| Area | What is included |
| --- | --- |
| **Public site** | Landing page (hero, live statistics, categories, “how it works”, CTA), sign-in, self-registration, 403 / 404 / 500 pages |
| **Complaints** | Registration with evidence image, auto-generated IDs, category/ward/location capture, priority, search, filters, debounce, pagination, CSV export |
| **Lifecycle** | Admin approval → officer assignment (one or many) → status updates with remarks → resolution or rejection with reason → full audit timeline |
| **Tracking** | Public-facing tracking by complaint ID **or** ration number, timeline of every action |
| **Dashboards** | Role-specific dashboards (citizen / officer / administrator) with KPI tiles and charts |
| **Analytics** | 4 chart families — category bars, status doughnut, monthly trend with year filter, ward distribution — plus category share panel and KPI progress bars |
| **KPIs** | Total & monthly complaints, resolution rate, pending rate, rejection rate, average resolution time, top category, highest complaint ward, month-over-month growth |
| **Reports** | Filter builder (date range, category, ward, officer, status, priority), on-screen preview with government heading, **server-side PDF export** and CSV export |
| **Administration** | Users (create / edit / activate / suspend), village officers, wards, complaint categories, database-backed application settings |
| **Notifications** | Notification centre with unread badge, mark-as-read, mark-all-read, auto-refresh — written automatically on every lifecycle event |
| **Account** | Profile editing, avatar upload, password change, active session list with per-session and global revoke, notification preferences, theme & language |
| **Presentation** | Light/dark theme (persisted, CSS variables), skeleton loaders, empty/error states, toasts, subtle animations, responsive from 320 px up, keyboard-accessible components |

---

## 2. Roles & permissions

### Citizen

- Register an account and sign in (email, mobile number or ration number).
- File complaints with category, description, street/location, ward, priority and an evidence image.
- View **only their own** complaints, with full status history.
- Track a complaint by complaint ID or ration number.
- Receive notifications for every change to their complaints.
- Update their own profile and notification preferences.

### Village Officer

- Work list of complaints **assigned to them**, plus a dashboard with workload KPIs.
- View complaint details, citizen contact information and evidence.
- Move assigned complaints to _In Progress_ and _Resolved_ with remarks.
- Add investigation remarks (each one is written to the complaint history).
- Update their own profile.

### Administrator

- Everything a village officer can do **across all wards**, plus:
- Approve or reject newly registered complaints (rejection requires a reason).
- Assign / re-assign complaints to one or more village officers.
- Reopen resolved complaints and override statuses along the permitted transitions.
- Full complaint register with search, filters, sorting, pagination and CSV export.
- Manage users, officers, wards and complaint categories.
- Analytics across the whole village and **report generation with PDF export**.
- Maintain portal settings (title, organisation, SLA days, auto-approve, session lifetime …).

Roles are enforced twice: the API protects every route with `authenticate` + `authorize(...role)`
middleware and scopes queries in the service layer (`citizen → own`, `officer → assigned`,
`admin → all`); the SPA guards routes with `<ProtectedRoute roles={[…]} />` and hides navigation
items the role cannot use. Attempting to open a forbidden page redirects to `/unauthorized`.

---

## 3. Complaint lifecycle

```
Citizen submits complaint  ──▶  validation (Zod + image checks)
        │
        ├─▶ unique ID generated  (VCMS-2026-000001 — atomic counter per year)
        ├─▶ status = Pending, complaint_history row, admins notified
        │
        ▼
Admin reviews ──▶ Approve ──▶ Assign officer ──▶ status = In Progress, officer notified
        │                                              │
        │                                              ├─▶ officer remarks (history rows)
        │                                              ├─▶ status = Resolved
        │                                              │     + resolution_date, resolution remarks
        │                                              │     + citizen notified, feeds analytics
        │                                              └─▶ status = Rejected
        │                                                    + rejection reason, rejected_by, timestamp
        │                                                    + citizen notified
        └─▶ Reject (reason ≥ 10 characters, stored with admin ID + timestamp)

Resolved complaints can be reopened by an administrator (status → In Progress).
```

Every transition is validated against a permitted-transition table, and **every** status change,
assignment, remark and approval writes a row to `complaint_history`, which is what the timeline in
the UI renders.

---

## 4. Technology stack

| Layer | Choice |
| --- | --- |
| Front end | React 18 + TypeScript 5.7, Vite 6, React Router 6 |
| Styling | Tailwind CSS 3.4 with CSS-variable design tokens (dark mode = `.dark` on `<html>`) |
| Charts | Recharts (category bars, status doughnut, monthly line, ward bars, priority bars) |
| Icons / fonts | `lucide-react`; self-hosted Inter + Noto Sans Tamil (`@fontsource`) |
| Back end | Node.js 20+, Express 4 (ESM) |
| Database | SQLite via `better-sqlite3` for zero-config development; **PostgreSQL** supported in production through the same Knex code path |
| Data access | Knex migrations + query builder (`sqlite3` dev, `pg` production) |
| Validation | Zod request schemas on every mutating endpoint |
| Auth | JWT access tokens (15 min) in an httpOnly cookie or `Authorization: Bearer`, rotating refresh tokens hashed in the `sessions` table |
| Security | bcryptjs hashing, Helmet, CORS allow-list, `express-rate-limit`, double-submit CSRF, Multer + Sharp image pipeline |
| PDF | `pdfkit` — server-side government-format report with heading, summary tiles, bar charts and a paginated complaint register |

---

## 5. Repository layout

```
VCMS/
├── client/                     # React + TypeScript single-page application
│   ├── src/
│   │   ├── components/         # ui/ (primitives), layout/, charts/, complaint/, dashboard/
│   │   ├── context/            # Auth, Theme, Toast, Notification providers
│   │   ├── hooks/              # useAsync, useDebouncedValue, useMediaQuery, useLocalStorage …
│   │   ├── lib/                # api client, formatting utils, constants, validators
│   │   ├── pages/              # public/, admin/, complaints/, settings/, dashboards, profile …
│   │   ├── App.tsx             # route table + providers
│   │   └── main.tsx
│   ├── index.html              # pre-paint theme bootstrap, meta tags
│   └── vite.config.ts          # /api + /uploads dev proxy, chunk splitting
├── server/                     # Express REST API
│   ├── src/
│   │   ├── config/             # env parsing, domain constants
│   │   ├── db/                 # Knex instance, migrations/, seed.js
│   │   ├── middleware/         # auth, rbac, csrf, rate limit, upload, errors
│   │   ├── services/           # business logic (complaints, analytics, reports, users …)
│   │   ├── controllers/        # thin HTTP layer
│   │   ├── routes/             # /api route modules
│   │   ├── validators/         # Zod schemas + request validator middleware
│   │   ├── utils/              # logger, errors, serializers, complaint-id generator
│   │   ├── app.js              # express app (middleware, static, SPA fallback)
│   │   └── index.js            # bootstrap + graceful shutdown
│   ├── tests/                  # end-to-end API workflow tests (node:test)
│   └── uploads/                # complaint evidence + avatars (git-ignored)
├── docs/API.md                 # full REST API reference
└── package.json                # npm workspaces + orchestration scripts
```

---

## 6. Quick start

### Prerequisites

- Node.js **20 or newer** (developed on Node 22) and npm 10+.
- No database server required for development — SQLite is file based.
- Optional: PostgreSQL 14+ for the production profile.

### Install and run

```bash
git clone <repository-url> VCMS
cd VCMS

# 1. install workspaces, create the schema and load demo data
npm run setup

# 2. copy the environment templates
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. (recommended) replace the JWT secrets in server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. start the API (:4000) and the web client (:5173) together
npm run dev
```

Open **http://localhost:5173** and sign in with one of the
[development accounts](#9-development-credentials).

Running just the API? `npm run dev:server`. The API also serves the compiled SPA from
`client/dist` when it exists, so `npm run build && npm start` gives you the whole portal on a
single port.

**Restoring a recycled environment.** Git-ignored artefacts (`node_modules/`, `server/.env`,
`client/.env`, the SQLite file and `client/dist`) are not part of the repository, so a fresh
container or sandbox can leave you with a clean checkout. One command recreates all of them —
dependencies (building native modules against local Node headers when the prebuild is unavailable),
environment files with freshly generated JWT secrets, the migrated + seeded database and the client
build:

```bash
bash scripts/dev-bootstrap.sh    # safe to re-run: every step is skipped when satisfied
npm run dev                      # then start the portal
```

---

## 7. Environment variables

### `server/.env` (see `server/.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `4000` | HTTP port |
| `DB_CLIENT` | `better-sqlite3` | `better-sqlite3` for local files, `pg` for PostgreSQL |
| `DB_FILENAME` | `./data/vcms.sqlite` | SQLite file path (dev/test) |
| `DATABASE_URL` | — | PostgreSQL connection string when `DB_CLIENT=pg` |
| `JWT_ACCESS_SECRET` | _required_ | Access-token signing secret (≥ 32 chars) |
| `JWT_REFRESH_SECRET` | _required_ | Refresh-token signing secret (≥ 32 chars) |
| `ACCESS_TOKEN_TTL` | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh-token / session lifetime in days |
| `COOKIE_SECURE` | `auto` | `auto` derives the `Secure` flag from the request protocol (proxy aware) |
| `COOKIE_SAME_SITE` | `lax` | Cookie SameSite policy |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origin allow-list (empty = same-origin only) |
| `UPLOAD_DIR` | `./uploads` | Root folder for evidence images and avatars |
| `MAX_UPLOAD_MB` | `5` | Maximum image upload size |
| `APP_NAME`, `APP_ORG`, `APP_TAGLINE` | VCMS / Government of Tamil Nadu / Digital Grievance Redressal Portal | Branding defaults (overridable at runtime from Settings) |
| `COMPLAINT_ID_PREFIX` | `VCMS` | Complaint ID prefix (`VCMS-2026-000001`) |
| `LOG_LEVEL` | `info` | `error` \| `warn` \| `info` \| `debug` |

### `client/.env` (see `client/.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_PROXY_TARGET` | `http://127.0.0.1:4000` | Dev-server proxy target for `/api` and `/uploads` |
| `VITE_APP_NAME` | `Village Complaint Management System` | Fallback title before `/api/public/branding` responds |

In production the client calls the API on the **same origin** through relative `/api` URLs, so no
CORS configuration is needed and httpOnly auth cookies work without third-party cookie exceptions.

---

## 8. Database, migrations & seed data

### Schema

| Table | Purpose |
| --- | --- |
| `users` | Citizens, village officers and administrators (bcrypt password hash, ward, ration number, designation, status) |
| `wards` | Village wards/divisions used for routing and analytics |
| `categories` | Complaint categories (name, slug, icon, colour, active flag, sort order) |
| `complaints` | Complaint register with denormalised citizen snapshot, location, priority, status, resolution metadata and evidence image |
| `complaint_counters` | Per-year counters that make complaint IDs gap-free and collision-free |
| `complaint_history` | Immutable audit trail: every status change, approval, assignment and remark |
| `officer_assignments` | Assignment records (who assigned whom, when, notes, active flag) |
| `notifications` | In-app notifications with type, severity, read flag and deep link |
| `notification_preferences` | Per-user delivery preferences (complaint / assignment / resolution / email / SMS) |
| `sessions` | Refresh-token sessions (hashed token, device, IP, expiry) for revocation and “active sessions” |
| `settings` | Database-backed application settings (portal title, SLA days, auto-approve, …) |
| `audit_logs` | Administrative audit log (user, action, entity, metadata, IP) |

Relationships: `complaints.citizen_id → users.id`, `complaints.category_id → categories.id`,
`complaints.ward_id → wards.id`, `complaints.assigned_officer_id → users.id`,
`complaint_history.complaint_id → complaints.id`, `notifications.user_id → users.id`,
`officer_assignments.complaint_id → complaints.id`, `sessions.user_id → users.id`.
Foreign keys are enforced (`PRAGMA foreign_keys = ON` on SQLite, real constraints on PostgreSQL).

### Migrations

```bash
npm run db:migrate     # apply every pending migration (idempotent)
npm run db:rollback    # roll the last batch back
npm run db:seed        # load demo data (skips when users already exist)
npm run db:reset       # rebuild the schema and re-seed from scratch
```

Migration files live in `server/src/db/migrations/` (`001_core_identity`, `002_complaint_domain`,
`003_engagement`) and are written for both SQLite and PostgreSQL.

### Seeded demonstration data

`npm run db:seed` generates a deterministic 18-month village dataset:

- 6 wards and 8 complaint categories,
- 23 users — 2 administrators, 6 village officers, 15 citizens,
- ≈168 complaints spread across every status, category, ward and priority, with realistic dates,
- 624 history events, 137 officer assignments and 444 notifications,
- 8 generated evidence images (rendered as WebP) on selected complaints.

### Using PostgreSQL in production

```bash
npm --workspace server install pg            # add the driver
# server/.env
DB_CLIENT=pg
DATABASE_URL=postgres://vcms_user:secret@localhost:5432/vcms
npm run db:migrate && npm run db:seed
```

Knex applies the same migrations; switches (`PRAGMA`), epoch conversions and `returning()` result
shapes are handled by the database layer, so application code is unchanged.

---

## 9. Development credentials

> These accounts exist **only** in the seeded development dataset. Never reuse them (or these
> passwords) in a production deployment — create real accounts and delete the demo users.

| Role | Sign-in | Password |
| --- | --- | --- |
| Administrator | `admin@vcms.gov.in` | `Admin@12345` |
| Administrator | `supervisor@vcms.gov.in` | `Admin@12345` |
| Village Officer | `raj.kumar@vcms.gov.in` | `Officer@12345` |
| Village Officer | `priya.anandan@vcms.gov.in` | `Officer@12345` |
| Citizen | `arun.kumar@example.com` | `Citizen@12345` |
| Citizen (mobile login) | `9845012345` | `Citizen@12345` |

The sign-in page also offers one-tap demo buttons for the first administrator, the first officer and
the first citizen — these only fill the form, never bypass authentication.

---

## 10. Scripts reference

| Command | Description |
| --- | --- |
| `npm run setup` | Install workspaces, run migrations, seed the database |
| `bash scripts/dev-bootstrap.sh` | Restore a recycled checkout: deps (incl. native modules), `.env` files, database, client build |
| `npm run dev` | Run API (:4000) and Vite dev server (:5173) together with coloured logs |
| `npm run dev:server` | API only, with `node --watch` auto-restart |
| `npm run dev:client` | Vite dev server only (proxies `/api` + `/uploads` to the API) |
| `npm run build` | Type-check (`tsc -b`) and build the client into `client/dist` |
| `npm start` | Start the API in the current `NODE_ENV`; serves `client/dist` when present |
| `npm run db:migrate` \| `db:rollback` \| `db:seed` \| `db:reset` | Database lifecycle |
| `npm test` | End-to-end API workflow tests (`node:test`, 33 tests) |

---

## 11. REST API

All endpoints live under `/api` and share a single response envelope:

```jsonc
// success
{ "success": true, "message": "Optional human readable message",
  "data": { /* payload */ },
  "meta": { "pagination": { "page": 1, "pageSize": 10, "total": 168, "totalPages": 17 } } }

// error
{ "success": false, "error": { "code": "VALIDATION_ERROR",
  "message": "Please correct the highlighted fields and try again.",
  "details": [{ "field": "description", "message": "…" }] } }
```

Error codes include `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`SESSION_EXPIRED`, `CSRF_FAILED`, `INVALID_REFERENCE`, `PAYLOAD_TOO_LARGE` and `RATE_LIMITED`.

A full endpoint-by-endpoint reference (parameters, payloads, role requirements, sample calls) is in
[`docs/API.md`](docs/API.md). Highlights:

```
GET    /api/public/branding          GET  /api/public/stats       GET  /api/public/csrf
POST   /api/auth/register            POST /api/auth/login         POST /api/auth/refresh
POST   /api/auth/logout              GET  /api/auth/me            POST /api/auth/change-password
GET    /api/auth/sessions            POST /api/auth/logout-all
GET    /api/complaints               POST /api/complaints         GET  /api/complaints/:id
PUT    /api/complaints/:id           DELETE /api/complaints/:id   GET  /api/complaints/track
POST   /api/complaints/:id/approve   POST /api/complaints/:id/assign
PUT    /api/complaints/:id/status    POST /api/complaints/:id/remarks
GET    /api/categories               POST /api/categories         PUT  /api/categories/:id
PATCH  /api/categories/:id/status    DELETE /api/categories/:id
GET    /api/wards                    POST /api/wards              PUT  /api/wards/:id
GET    /api/users                    POST /api/users              PUT  /api/users/:id
PATCH  /api/users/:id/status         DELETE /api/users/:id         GET  /api/users/officers
GET    /api/users/me/preferences     PUT  /api/users/me/preferences
PUT    /api/users/me/profile         POST /api/users/me/avatar
GET    /api/notifications            PUT  /api/notifications/:id/read   PUT /api/notifications/read-all
GET    /api/analytics/dashboard      GET  /api/analytics/{summary,categories,monthly,status,wards,priority}
GET    /api/reports                  GET  /api/reports/pdf       GET  /api/settings   PUT /api/settings
GET    /api/health
```

---

## 12. Security controls

| Threat | Mitigation |
| --- | --- |
| Password theft | bcrypt hashing (cost 10) — plaintext passwords are never stored or logged |
| Session hijacking | Short-lived access JWTs in httpOnly cookies (`SameSite=Lax`, `Secure` in production) plus rotating refresh tokens stored **hashed** server-side and revocable per device |
| Cross-site request forgery | Double-submit cookie: readable `vcms_csrf` cookie must be echoed in the `x-csrf-token` header on every mutating request (Bearer clients are exempt by design) |
| Cross-site scripting | React auto-escaping, a strict Helmet Content-Security-Policy, no `dangerouslySetInnerHTML` |
| SQL injection | Knex parameter binding everywhere — no string-concatenated SQL |
| Brute force | `express-rate-limit` — strict limiter on `/api/auth/*`, generous limiter on the rest of the API |
| Malicious uploads | Multer memory storage + MIME/extension/size allow-list, then Sharp re-encodes every image to WebP (strips metadata and any embedded payload) |
| Privilege escalation | `authenticate` + `authorize()` on every protected route, service-layer query scoping, and self-protection rules (an admin cannot demote, deactivate or delete themselves, nor remove the last active administrator) |
| Broken input trust | Zod validation on params, query strings and bodies; multipart coerced into the same schemas |
| Information leakage | Generic error envelopes, no stack traces in production, admin-only report/settings/users endpoints, public endpoints expose aggregates only |
| Transport | Helmet defaults, `trust proxy` aware secure cookies, CORS allow-list with credentials |

---

## 13. UI, accessibility & theming

- **Visual identity** — deep blue (`#10367a`) primary, white surfaces, restrained red (`#b91c1c`)
  accents, grey text. Flat government styling: no excessive gradients.
- **Masthead** — “Government of Tamil Nadu”, “Village Complaint Management System” and “Digital
  Grievance Redressal Portal” appear in the sidebar, topbar and landing page, with a
  *demonstration build* disclaimer in the footer.
- **Dark mode** — every colour is a CSS variable, so the `.dark` class on `<html>` re-themes the
  whole app. The preference (`light` \| `dark` \| `system`) is stored in `localStorage` and applied
  before first paint, so there is no flash of the wrong theme.
- **Responsive** — single-column mobile layouts with drawer navigation, card-based tables on small
  screens, and multi-column dashboards from 1024 px up.
- **Accessibility** — semantic landmarks, every input has an associated label, error messages use
  `role="alert"`, charts carry text alternatives, dialogs trap focus and close on `Escape`, skip
  link, visible focus rings, `aria-current` on navigation, `aria-pressed`/`role="switch"` on
  toggles, alt text on all images.
- **Feedback** — skeleton loaders while fetching, illustrated empty states, retryable error states,
  toast notifications, `aria-live` regions for async results.
- **Motion** — short (150–600 ms) fade/slide/scale animations that respect
  `prefers-reduced-motion` for users who ask for less movement.

---

## 14. Testing

```bash
npm test          # 33 end-to-end API tests, ~5 seconds
```

The suite (`server/tests/workflow.test.js`, `node:test`) boots the real application against a
throw-away SQLite database and walks the entire product surface:

- registration, login by email/mobile/ration, refresh, logout, session and password flows,
- CSRF enforcement (missing token is rejected), rate-limit headers, RBAC denials,
- complaint creation with a real multipart image (asserting the `VCMS-YYYY-NNNNNN` ID format and the
  WebP upload path), search, filters, pagination, tracking,
- the full lifecycle: approve → assign → in progress → resolve, plus rejection with a reason and
  history assertions for every transition,
- scope correctness for `mine=true` (citizen: own complaints, officer: assigned work) and tracking by
  complaint ID or ration number,
- admin category/ward/user/settings management, notifications read/unread,
- analytics responses and the generated report **PDF** (validated by its `%PDF-` magic bytes).

---

## 15. Verification checklist

| # | Requirement | How to verify |
| --- | --- | --- |
| 1 | Landing page with hero, statistics and CTAs | Open `/` while signed out |
| 2 | Self-registration and sign-in | `/register`, then `/login` (email, mobile or ration number) |
| 3 | Role-based dashboards | Sign in as citizen, officer and administrator |
| 4 | Complaint registration with auto ID | `/complaints/new` → reference `VCMS-2026-0001xx` |
| 5 | Image upload validation | Try a `.txt` file or an image larger than 5 MB — rejected client- and server-side |
| 6 | Category management (database backed) | Admin → Categories → create/edit/deactivate |
| 7 | Ward management | Admin → Wards → create/edit |
| 8 | Admin approval | Admin → complaint details → **Approve** |
| 9 | Officer assignment | Admin → complaint → **Assign officer** (history entry created) |
| 10 | Officer status updates with remarks | Officer → complaint → **Update status** / **Add remark** |
| 11 | Resolution stores date and remarks | Resolve a complaint and open its timeline |
| 12 | Rejection stores reason, admin and timestamp | Reject with a ≥ 10-character reason |
| 13 | Complaint history timeline | Any complaint → timeline section lists every transition |
| 14 | Tracking by complaint ID or ration number | `/track` with `VCMS-2026-000100` or `TN123456789` |
| 15 | Search, filter, debounce, pagination, sort | `/complaints` — type, change filters, change rows/sort |
| 16 | Notification centre with unread badge | Bell in the topbar → `/notifications` → mark read / read all |
| 17 | Analytics — 4 chart families | `/reports` (category bars, status doughnut, monthly line with year select, ward bars) |
| 18 | KPIs incl. rates, average time, growth | KPI tiles on `/reports` and role dashboards |
| 19 | Report generation with filters + PDF export | Admin → `/reports` → set filters → **Generate report** → **Export PDF** |
| 20 | Skeleton / empty / error states and toasts | Every fetch shows a skeleton; force an error (stop the API) and retry |
| 21 | Dark mode (persisted) | Topbar theme toggle or `/settings` → reload the page |
| 22 | Responsive layout | Narrow the window to 360 px — drawer navigation, card tables |
| 23 | Accessibility | Tab through the sign-in form, open a dialog, inspect aria attributes |
| 24 | Unauthorized redirect | Sign in as a citizen and open `/users` → `/unauthorized` |
| 25 | Session expiry handling | Delete the cookies, then click anything — you are redirected to sign in |
| 26 | Database relationships | `sqlite3 server/data/vcms.sqlite '.tables'` and inspect the foreign keys |

---

## 16. Production deployment

```bash
# 1. build the client (type-checked, hashed assets)
npm run build

# 2. configure the server
cp server/.env.example server/.env
#   NODE_ENV=production
#   DB_CLIENT=pg + DATABASE_URL=postgres://…
#   fresh 48-byte JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
#   CORS_ORIGINS=https://your-domain.example
#   COOKIE_SECURE=true

# 3. create the schema and (optionally) the demo data
npm run db:migrate
npm run db:seed          # or create the first administrator manually

# 4. start the API — it also serves client/dist on the same origin
npm start
```

Deployment notes:

- Put the process behind a reverse proxy that terminates TLS and forwards
  `X-Forwarded-Proto`/`X-Forwarded-For` (the app sets `trust proxy`).
- Keep `server/uploads/` on a persistent volume (or move to object storage by replacing the upload
  middleware target).
- Back up the database and the uploads folder; `audit_logs` and `complaint_history` are the records
  a grievance redressal system is legally expected to retain.
- Rotate `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` and re-issue administrator passwords after any
  demo deployment has been public.

---

## 17. Extensibility roadmap

The codebase is deliberately structured so the following can be added without re-architecting:

| Enhancement | Where it plugs in |
| --- | --- |
| **GPS / map location** | `complaints.latitude`/`longitude` columns, `location` validation and the location card in complaint details already exist — add a map picker to `NewComplaintPage` |
| **Email & SMS notifications** | `notificationService` dispatches in-app notifications today and reads the per-user email/SMS preferences; add an SMTP/`SMS_API_KEY` provider in the same service |
| **AI complaint classification** | `complaintService.createComplaint` receives the description before insert — call a classifier to suggest `category_id`/`priority` and fall back to the citizen's choice |
| **Internationalisation** | User `preferredLanguage` and the Tamil font are already wired; move UI strings into `i18n` resources and add a Tamil catalogue |
| **Mobile app** | The REST API is token-based (Bearer) and CSRF-exempt for Bearer clients — a React Native client can reuse every endpoint |
| **Additional reports** | `reportService.buildReport()` produces one data structure consumed by both the JSON preview and the PDF renderer — add formats (Excel, Dashboards) there |
| **Workflow re-tuning** | `ALLOWED_TRANSITIONS` and complaint settings (SLA days, auto-approve) are data-driven, editable from Settings |

---

## 18. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE :4000` | Another API instance is running — stop it or change `PORT` in `server/.env` |
| API calls fail with `CSRF_FAILED` | The SPA bootstraps the token from `/api/public/csrf`; make sure the client is reached through the Vite proxy (relative `/api` URLs), or refresh the page |
| Requests return 401 immediately after sign-in | Cookies are blocked or `COOKIE_SECURE=true` on a plain-HTTP origin — use `COOKIE_SECURE=auto` in development |
| Images do not display | The `/uploads` path is served by the API; in dev make sure the proxy entry for `/uploads` is intact |
| `npm test` fails with a database error | Stale test artifacts — remove `server/data/*.test*.sqlite*` and re-run |
| Native build error for `better-sqlite3` | Use Node 20/22 LTS and re-run `npm install`; the project pins `better-sqlite3` ^13 for prebuilt binaries |
| Charts render empty | Analytics responses are scoped to the signed-in role — a new citizen with no complaints legitimately sees zero values |

---

Built as a reference implementation of a **citizen-first digital grievance redressal portal**:
accessible, auditable, secure and ready to extend.
