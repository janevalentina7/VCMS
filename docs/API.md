# VCMS REST API reference

Base URL: `http://localhost:4000/api` (development) — the client reaches it through relative `/api`
URLs, so the same-origin deployment needs no configuration.

* [Conventions](#conventions)
* [Authentication & CSRF](#authentication--csrf)
* [Public](#public)
* [Authentication](#authentication)
* [Complaints](#complaints)
* [Categories](#categories)
* [Wards](#wards)
* [Users](#users)
* [Notifications](#notifications)
* [Analytics](#analytics)
* [Reports](#reports)
* [Settings](#settings)
* [Health](#health)

---

## Conventions

### Response envelope

```jsonc
// success
{
  "success": true,
  "message": "Complaint registered successfully.",       // optional
  "data": { /* payload — object or array */ },
  "meta": {                                              // only for paginated list endpoints
    "pagination": { "page": 1, "pageSize": 10, "total": 168, "totalPages": 17, "hasNext": true, "hasPrev": false }
  }
}

// failure
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields and try again.",
    "details": [{ "field": "description", "message": "Complaint description must be at least 30 characters." }],
    "path": "/api/complaints"
  }
}
```

### Error codes

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Malformed request |
| 401 | `UNAUTHENTICATED` / `SESSION_EXPIRED` | Missing, invalid or expired access token |
| 403 | `FORBIDDEN` | Role may not perform the action |
| 403 | `CSRF_FAILED` | CSRF cookie/header missing or mismatched |
| 404 | `NOT_FOUND` | Resource does not exist (or is outside your scope) |
| 405 | `METHOD_NOT_ALLOWED` | Wrong verb |
| 409 | `CONFLICT` | Duplicate email / mobile / ration number, invalid workflow transition |
| 413 | `PAYLOAD_TOO_LARGE` | Upload exceeds `MAX_UPLOAD_MB` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Upload is not JPG/JPEG/PNG/WEBP |
| 422 | `VALIDATION_ERROR` | Zod validation failed (`error.details[]` lists the fields) |
| 429 | `RATE_LIMITED` | Too many requests (see `RateLimit-*` headers) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### Pagination, sorting & filtering

List endpoints accept `page` (default `1`), `pageSize` (default `10`, max `100`) and `sort`
(`newest` \| `oldest` \| `priority` \| `status` where applicable). Pagination is returned in
`meta.pagination`.

### Date formats

All timestamps in responses are ISO-8601 UTC strings (`2026-02-14T09:30:00.000Z`). Date filters
(`from`, `to`) accept `YYYY-MM-DD` and are interpreted inclusively in UTC.

---

## Authentication & CSRF

Two credentials are supported:

1. **Cookie session (browser SPA)** — `POST /api/auth/login` sets an httpOnly `vcms_access` cookie
   (`SameSite`, `Secure` derived from the request protocol) plus a readable `vcms_csrf` cookie.
   Every mutating request must echo the CSRF cookie in the `x-csrf-token` header.
2. **Bearer token (CLI, tests, mobile)** — the same endpoint returns `data.accessToken`
   (15 minutes). Bearer requests are exempt from CSRF because they are not cookie-authenticated.

```bash
# 1. bootstrap the CSRF cookie
curl -c cookies.txt http://localhost:4000/api/public/csrf
CSRF=$(awk '$6=="vcms_csrf" {print $7}' cookies.txt)

# 2. sign in
curl -b cookies.txt -c cookies.txt -H 'Content-Type: application/json' \
     -H "x-csrf-token: $CSRF" \
     -d '{"identifier":"admin@vcms.gov.in","password":"Admin@12345"}' \
     http://localhost:4000/api/auth/login

# 3. call a protected endpoint
curl -b cookies.txt http://localhost:4000/api/auth/me
```

Access tokens last `ACCESS_TOKEN_TTL` (default 15 minutes); when the API answers `401
SESSION_EXPIRED` the client calls `POST /api/auth/refresh` once (rotating the refresh token, which is
stored **hashed** in the `sessions` table) and retries the original request.

---

## Public

### `GET /api/public/branding`

Portal name, organisation, tagline, complaint ID prefix and upload limit. Anonymous.

```json
{ "appName": "Village Complaint Management System", "organisation": "Government of Tamil Nadu",
  "tagline": "Digital Grievance Redressal Portal", "complaintPrefix": "VCMS", "maxUploadMb": 5 }
```

### `GET /api/public/stats`

Aggregate counters for the landing page (totals, resolution rate, citizens, categories). Anonymous.
No personal data is exposed.

### `GET /api/public/csrf`

Issues the double-submit CSRF cookie/token. Anonymous.

---

## Authentication

| Method & path | Role | Body / notes |
| --- | --- | --- |
| `POST /api/auth/register` | public | `name`, `email`, `mobile`, `password`, `confirmPassword?`, `rationNumber?`, `wardId?`, `address?`. Self-registration always creates a **citizen**; `role` is ignored for non-admins. Returns the user + tokens. |
| `POST /api/auth/login` | public | `identifier` (email, 10-digit mobile or ration number), `password`, `remember?`. Strictly rate-limited. |
| `POST /api/auth/refresh` | public | Rotates the refresh token using the `vcms_refresh` cookie. |
| `POST /api/auth/logout` | any | Revokes the current session, clears cookies. |
| `GET /api/auth/me` | any | `{ user, permissions, branding }` — `user.preferences` carries notification preferences. |
| `GET /api/auth/sessions` | any | Active sessions for the caller (device, IP, created, expiry, `current`). |
| `DELETE /api/auth/sessions/:id` | any | Revokes one of the caller's own sessions. |
| `POST /api/auth/logout-all` | any | Revokes every other session and bumps the token version. |
| `POST /api/auth/change-password` | any | `currentPassword`, `newPassword`, `confirmPassword?`. Rejects reuse of the current password; **all sessions are revoked** afterwards. |

---

## Complaints

| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /api/complaints` | any | Scoped list. Query: `q`, `status` (`pending\|in_progress\|resolved\|rejected\|all\|open`), `priority`, `categoryId`, `wardId`, `officerId`, `citizenId`, `from`, `to`, `sort`, `page`, `pageSize`, `mine` (`true` = assigned to me for officers/admins, raised by me for citizens). |
| `GET /api/complaints/:id` | any | Full detail: complaint, citizen snapshot, active assignment, history array and assignment array. Accepts the numeric id or the reference (`VCMS-2026-000100`). Scoped — a citizen can only open their own complaint. |
| `POST /api/complaints` | citizen, admin | `multipart/form-data`: `citizenName`, `rationNumber`, `mobileNumber`, `categoryId` *(required)*, `description` (30–2000 chars), `streetName`, `area?`, `location`, `wardId?`, `priority`, `latitude?`, `longitude?`, `image?`. Generates `VCMS-<year>-<000001>` atomically, writes the `created` history row and notifies administrators. |
| `PUT /api/complaints/:id` | owner citizen, admin, assigned officer | `categoryId?`, `description?`, `streetName?`, `area?`, `location?`, `wardId?`, `priority?`, `mobileNumber?`, `remarks?`. Writes an `updated` history row. |
| `DELETE /api/complaints/:id` | owner citizen, admin | Deletes the complaint, its history, assignments and notifications. A citizen may only withdraw a complaint while it is still `pending`; administrators can delete at any status. |
| `GET /api/complaints/track` | any | `complaintId` **or** `rationNumber`. Returns matching complaints with full timelines for the status-tracking page. |
| `GET /api/complaints/:id/history` | any | History rows only. |
| `POST /api/complaints/:id/approve` | admin | `remarks?`. `pending → in_progress`, notifies the citizen. |
| `POST /api/complaints/:id/assign` | admin | `officerId` *(required)*, `notes?`. Deactivates the previous assignment, sets `assigned_officer_id`, moves `pending → in_progress`, notifies the officer and the citizen. |
| `PUT /api/complaints/:id/status` | admin, assigned officer | `status`, `remarks?`, `resolutionRemarks?`, `rejectionReason?`. `Rejected` requires a ≥ 10-character reason; `Resolved` requires ≥ 10-character resolution remarks and stamps `resolution_date` + `resolved_by`. Every change writes a history row and notifies the citizen. |
| `POST /api/complaints/:id/remarks` | admin, assigned officer | `remarks` (3–2000 chars), `status?`. Remarks are appended to history and notify the citizen. |

**Permitted status transitions**

| From | Admin | Officer |
| --- | --- | --- |
| `pending` | `pending`, `in_progress`, `rejected` | `in_progress` |
| `in_progress` | `in_progress`, `resolved`, `rejected`, `pending` | `resolved` |
| `resolved` | `resolved`, `in_progress` | — |
| `rejected` | `rejected`, `pending` | — |

**Image uploads** accept JPG, JPEG, PNG and WEBP up to `MAX_UPLOAD_MB` (default 5 MB). The MIME type,
file extension and size are all validated, then Sharp re-encodes the image to WEBP (max 1600 px wide)
so metadata and embedded payloads never reach the filesystem. The stored path is returned as
`imageUrl` (`/uploads/complaints/vcms-<timestamp>-<hash>.webp`).

---

## Categories

| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /api/categories` | any | Query: `includeInactive`, `withCounts`. Returns the seeded eight categories. |
| `POST /api/categories` | admin | `name` (≥3), `description?`, `icon?`, `colour?` (`#rrggbb`), `active?`, `sortOrder?`. Slug is derived from the name. |
| `PUT /api/categories/:id` | admin | Partial update of the same fields. |
| `PATCH /api/categories/:id/status` | admin | `{ "active": true \| false }` — deactivate to hide from the complaint form without losing history. |
| `DELETE /api/categories/:id` | admin | Refused with `409 CONFLICT` when complaints reference the category (deactivate instead). |

Seeded categories: Water Supply Issues, Road Damage, Street Light Problems, Garbage Collection,
Drainage Issues, Public Health Issues, Sanitation Issues, Other Complaints.

---

## Wards

| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /api/wards` | any | Query: `includeInactive`, `withCounts` (officer + complaint counts). |
| `POST /api/wards` | admin | `name`, `code`, `village?`, `description?`, `active?`. |
| `PUT /api/wards/:id` | admin | Partial update; `active: false` stops new complaints being routed there. |

---

## Users

| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /api/users` | admin | Query: `q` (name, email, mobile, ration number, ward), `role`, `status`, `wardId`, `sort` (`newest\|oldest\|name`), `page`, `pageSize`. |
| `POST /api/users` | admin | `name`, `email`, `mobile`, `password`, `role` (`citizen\|officer\|admin`), `wardId?`, `rationNumber?`, `designation?`, `address?`, `status?`. |
| `GET /api/users/stats` | admin | Counts grouped by role. |
| `GET /api/users/officers` | admin, officer | Officer list with `activeAssignments` and `resolvedCount`, for assignment dropdowns. Query: `wardId`, `includeInactive`. |
| `GET /api/users/:id` | self or admin | Profile of a user. |
| `PUT /api/users/:id` | admin | Update details/role/ward/ration/status. Admin self-protection rules apply (no self-demotion, no self-deactivation, last administrator cannot be removed). |
| `PATCH /api/users/:id/status` | admin | `{ "status": "active" \| "inactive" \| "suspended" }`. |
| `DELETE /api/users/:id` | admin | Deletes a user. Returns `409 CONFLICT` when the account is linked to complaints (deactivate it instead so history is preserved) and refuses self-deletion and removal of the last active administrator. |
| `GET /api/users/me/preferences` | any | Notification preferences. |
| `PUT /api/users/me/preferences` | any | `complaintNotifications`, `assignmentNotifications`, `resolutionNotifications`, `emailNotifications`, `smsNotifications` (all booleans, partial). |
| `PUT /api/users/me/profile` | any | `name?`, `email?`, `mobile?`, `address?`, `wardId?`, `rationNumber?`, `preferredLanguage?`. |
| `POST /api/users/me/avatar` | any | `multipart/form-data` field `avatar` (same image rules as complaint evidence). |
| `GET /api/users/me/sessions` | any | Alias of `GET /api/auth/sessions`. |

---

## Notifications

| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /api/notifications` | any | Query: `unreadOnly` (`true\|false`), `limit`, `page`, `pageSize`. `meta.unreadCount` drives the bell badge. Designed to be polled. |
| `GET /api/notifications/unread-count` | any | `{ "unreadCount": 11 }` — cheapest badge poll. |
| `PUT /api/notifications/:id/read` | any (owner) | `{ "isRead": true \| false }`, defaults to `true`. |
| `PUT /api/notifications/read-all` | any | Marks every unread notification of the caller as read. |

Notification `type` values: `complaint_registered`, `complaint_approved`, `complaint_assigned`,
`status_updated`, `remark_added`, `complaint_resolved`, `complaint_rejected`, `user_welcome`,
`account_updated`. Each carries `severity` (`info\|success\|warning\|error`) and a `link` such as
`/complaints/42` for deep linking.

---

## Analytics

All analytics endpoints require authentication and are automatically **scoped** to the caller:
citizens see their own complaints, officers see assigned ones, administrators see the whole village.
Common query: `year`, `from`, `to`, `wardId`, `categoryId`.

| Method & path | Role | Returns |
| --- | --- | --- |
| `GET /api/analytics/dashboard` | any | `{ kpis, charts, scope }` — the single call that powers every dashboard. |
| `GET /api/analytics/summary` | any | KPIs only. |
| `GET /api/analytics/categories` | any | Category distribution (count, percentage, colour). |
| `GET /api/analytics/monthly` | any | Monthly series for a year plus the list of available years. |
| `GET /api/analytics/status` | any | Status distribution with percentages. |
| `GET /api/analytics/wards` | any | Registered vs resolved per ward. |
| `GET /api/analytics/priority` | any | Priority distribution. |
| `GET /api/analytics/recent` | any | Most recent complaints within scope. |
| `GET /api/analytics/officers` | admin | Per-officer workload and resolution performance. |
| `GET /api/analytics/officer-summary` | officer | Officer dashboard KPIs (assigned, overdue, resolved, average days). |
| `GET /api/analytics/citizen-summary` | citizen | Citizen dashboard KPIs. |

`kpis` contains: `total`, `pending`, `in_progress`, `resolved`, `rejected`, `priority{}`,
`resolutionRate`, `pendingRate`, `rejectionRate`, `inProgressRate`, `averageResolutionDays`,
`thisMonth`, `lastMonth`, `monthlyGrowth`, `mostCommonCategory`, `highestComplaintWard`.

---

## Reports

| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /api/reports` | admin | JSON report used by the on-screen preview. Query: `from`, `to`, `categoryId`, `wardId`, `officerId`, `status`, `priority`. Returns `meta` (government heading, generated by/at, disclaimer), the resolved `filters`, `summary` (totals, rates, breakdowns by priority/category/ward/officer), the `complaints` register and `reference` lists. |
| `GET /api/reports/pdf` | admin | Same filters, streams a PDF (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="VCMS-Complaint-Report-<date>.pdf"`) containing the government heading, an eight-tile statistics summary, bar charts, a paginated complaint register and the disclaimer. |

```bash
curl -b cookies.txt -o report.pdf \
  'http://localhost:4000/api/reports/pdf?from=2026-01-01&to=2026-09-30&status=resolved&wardId=1'
```

---

## Settings

| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /api/settings` | admin | `{ settings: [{ key, value, label, group, type, updatedAt }], grouped: { general: [...], workflow: [...], notifications: [...], security: [...] } }`. |
| `PUT /api/settings` | admin | Either `{ "settings": { "complaint.slaDays": 7 } }` or a flat object of key/value pairs. Unknown keys are ignored; values are coerced to the declared `type` (`string`, `number`, `boolean`). Cache is invalidated immediately. |

Seeded settings: `portal.title`, `portal.organisation`, `portal.tagline`,
`complaint.autoApprove`, `complaint.slaDays`, `complaint.allowImageUpload`,
`notification.broadcastToOfficers`, `security.sessionDays`.

---

## Health

### `GET /api/health`

Anonymous, rate-limit-exempt liveness probe used by the client and by deployment health checks:

```json
{ "success": true,
  "data": { "status": "ok", "env": "development", "uptimeSeconds": 42, "timestamp": "2026-10-06T16:24:27.718Z" } }
```

### `GET /api`

Discovery endpoint listing the API name, version and route index.

---

## Appendix — role capability matrix

| Capability | Citizen | Officer | Admin |
| --- | :---: | :---: | :---: |
| Register / track own complaints | ✅ | ✅ | ✅ |
| View assigned complaints | — | ✅ | ✅ |
| View all complaints | — | — | ✅ |
| Approve / reject | — | — | ✅ |
| Assign officers | — | — | ✅ |
| Update status | — | assigned only | ✅ |
| Add remarks | — | assigned only | ✅ |
| Delete complaint | own | — | ✅ |
| Manage users / officers / wards / categories | — | — | ✅ |
| Village-wide analytics | — | — | ✅ |
| Generate reports & export PDF | — | — | ✅ |
| Maintain portal settings | — | — | ✅ |
