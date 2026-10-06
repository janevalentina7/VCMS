/**
 * End-to-end integration tests covering the complete grievance workflow
 * required by the specification (citizen → admin → officer → citizen),
 * plus authorization, validation, search, analytics and PDF export.
 *
 * Run with:  npm test   (from the server workspace, or `npm test` at the root)
 */
import { removeTestDatabase } from './helpers/setupEnv.js'; // must run before the app modules
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import knexFactory from 'knex';
import sharp from 'sharp';

import { createApp } from '../src/app.js';
import { db, closeDatabase } from '../src/db/index.js';
import config from '../src/config/env.js';
import { CATEGORY_SEED, WARD_SEED, ROLES } from '../src/config/constants.js';
import { hashPassword } from '../src/services/authService.js';
import { ensureDefaults } from '../src/services/settingsService.js';
import { ApiClient } from './helpers/client.js';

let server;
let baseUrl;

const ADMIN = { email: 'admin.test@vcms.gov.in', password: 'Admin@12345' };
const OFFICER = { email: 'officer.test@vcms.gov.in', password: 'Officer@12345' };
let OFFICER_USER_ID = null; // resolved in the before() hook
const CITIZEN = { name: 'Test Citizen', email: 'citizen.test@example.com', password: 'Citizen@12345', mobile: '9876500123', rationNumber: 'TN998877665' };

const client = () => new ApiClient(baseUrl).bootstrap();

before(async () => {
  // Fresh schema for the test database.
  const knex = knexFactory({ client: 'better-sqlite3', connection: { filename: config.db.filename }, useNullAsDefault: true });
  await knex.migrate.latest({ directory: new URL('../src/db/migrations', import.meta.url).pathname });
  await knex.destroy();

  await db('wards').insert(WARD_SEED.map((w) => ({ ...w, name: `${w.name} — Test`, active: true, created_at: new Date() })));
  await db('categories').insert(CATEGORY_SEED.map((c, i) => ({ ...c, active: true, sort_order: i + 1, created_at: new Date() })));

  const ward = await db('wards').first();
  const adminHash = await hashPassword(ADMIN.password);
  const officerHash = await hashPassword(OFFICER.password);
  await db('users').insert([
    { name: 'Test Administrator', email: ADMIN.email, mobile: '9800000011', password_hash: adminHash, role: ROLES.ADMIN, ward_id: ward.id, status: 'active', created_at: new Date() },
    { name: 'Test Officer', email: OFFICER.email, mobile: '9800000022', password_hash: officerHash, role: ROLES.OFFICER, ward_id: ward.id, status: 'active', created_at: new Date() },
  ]);
  OFFICER_USER_ID = (await db('users').where({ email: OFFICER.email }).first()).id;
  await ensureDefaults();

  const app = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
  removeTestDatabase();
});

describe('authentication & authorization', () => {
  test('citizens can register and receive a session', async () => {
    const api = await client();
    const res = await api.post('/api/auth/register', CITIZEN);
    assert.equal(res.status, 201);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.user.role, 'citizen');
    assert.ok(res.data.data.user.id);
    assert.equal(res.data.data.user.passwordHash, undefined, 'password hash must never be exposed');
    assert.ok(api.cookies.get('vcms_at'), 'access cookie issued');
  });

  test('duplicate registration is rejected with a friendly conflict', async () => {
    const api = await client();
    const res = await api.post('/api/auth/register', CITIZEN);
    assert.equal(res.status, 409);
  });

  test('invalid mobile and weak password fail validation', async () => {
    const api = await client();
    const res = await api.post('/api/auth/register', {
      name: 'Bad Data',
      email: 'bad@example.com',
      mobile: '12345',
      password: 'short',
      rationNumber: 'XX1',
    });
    assert.equal(res.status, 422);
    const fields = res.data.error.details.map((d) => d.field);
    assert.ok(fields.includes('mobile'));
    assert.ok(fields.includes('password'));
    assert.ok(fields.includes('rationNumber'));
  });

  test('writes without a CSRF token are refused', async () => {
    const api = await client();
    const res = await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password }, { skipCsrf: true });
    assert.equal(res.status, 403);
  });

  test('wrong password is rejected', async () => {
    const api = await client();
    const res = await api.post('/api/auth/login', { identifier: ADMIN.email, password: 'WrongPassword1' });
    assert.equal(res.status, 401);
  });

  test('unauthenticated access to protected routes is blocked', async () => {
    const api = await client();
    for (const path of ['/api/complaints', '/api/users', '/api/notifications', '/api/analytics/dashboard']) {
      const res = await api.get(path);
      assert.equal(res.status, 401, `${path} should require authentication`);
    }
  });

  test('citizens cannot reach administrative endpoints', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    for (const path of ['/api/users', '/api/reports', '/api/settings']) {
      const res = await api.get(path);
      assert.equal(res.status, 403, `${path} should be forbidden for citizens`);
    }
  });
});

let complaint;
let complaintId;

describe('complaint registration', () => {
  test('citizen can submit a complaint with an evidence image', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });

    const image = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 20, g: 60, b: 120 } } })
      .jpeg()
      .toBuffer();

    const form = new FormData();
    const category = await db('categories').where({ slug: 'street-light' }).first();
    const ward = await db('wards').first();
    form.append('citizenName', CITIZEN.name);
    form.append('rationNumber', CITIZEN.rationNumber);
    form.append('mobileNumber', CITIZEN.mobile);
    form.append('categoryId', String(category.id));
    form.append('wardId', String(ward.id));
    form.append('description', 'The street light near the primary school in Gandhi Street has not been working for the past five days.');
    form.append('streetName', 'Gandhi Street');
    form.append('location', 'Ward 4, Gandhi Street');
    form.append('priority', 'high');
    form.append('image', new Blob([image], { type: 'image/jpeg' }), 'evidence.jpg');

    const res = await api.request('POST', '/api/complaints', { form });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    complaint = res.data.data;
    complaintId = complaint.complaintId;

    assert.match(complaintId, /^VCMS-\d{4}-\d{6}$/, 'complaint id format VCMS-YYYY-NNNNNN');
    assert.equal(complaint.status, 'pending');
    assert.equal(complaint.priority, 'high');
    assert.ok(complaint.imageUrl, 'image stored');
    assert.match(complaint.imageUrl, /^\/uploads\/complaints\/vcms-\d+-[a-f0-9]+\.webp$/, 're-encoded to a safe webp filename');
    assert.ok(complaint.history.some((h) => h.action === 'created'), 'history written');
  });

  test('validation errors are returned with field level detail', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    const res = await api.post('/api/complaints', {
      citizenName: 'Arun123',
      rationNumber: 'INVALID',
      mobileNumber: '12345',
      description: 'too short',
      streetName: 'AB',
      location: '',
      priority: 'urgent',
    });
    assert.equal(res.status, 422);
    const fields = new Set(res.data.error.details.map((d) => d.field));
    for (const field of ['citizenName', 'rationNumber', 'mobileNumber', 'description', 'location', 'priority']) {
      assert.ok(fields.has(field), `expected a validation error for ${field}`);
    }
  });

  test('malformed image uploads are rejected', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    const category = await db('categories').where({ slug: 'other' }).first();
    const form = new FormData();
    form.append('citizenName', CITIZEN.name);
    form.append('rationNumber', CITIZEN.rationNumber);
    form.append('mobileNumber', CITIZEN.mobile);
    form.append('categoryId', String(category.id));
    form.append('description', 'A valid description that easily passes the thirty character minimum length rule.');
    form.append('streetName', 'Gandhi Street');
    form.append('location', 'Ward 4, Gandhi Street');
    form.append('priority', 'low');
    form.append('image', new Blob([Buffer.from('<?php echo "not an image"; ?>')], { type: 'image/jpeg' }), 'payload.jpg');

    const res = await api.request('POST', '/api/complaints', { form });
    assert.equal(res.status, 400, 'renamed non-image payload must be rejected');
  });
});

describe('complaint workflow', () => {
  test('complaint ids are unique and sequential', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    const category = await db('categories').where({ slug: 'garbage' }).first();
    const payload = {
      citizenName: CITIZEN.name,
      rationNumber: CITIZEN.rationNumber,
      mobileNumber: CITIZEN.mobile,
      categoryId: category.id,
      description: 'Garbage has not been collected from Gandhi Street for six days and the bin is overflowing badly.',
      streetName: 'Gandhi Street',
      location: 'Ward 4, Gandhi Street',
      priority: 'medium',
    };
    const first = await api.post('/api/complaints', payload);
    const second = await api.post('/api/complaints', payload);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.data.data.complaintId, second.data.data.complaintId, 'reference numbers must be unique');
    const seq1 = Number(first.data.data.complaintId.split('-')[2]);
    const seq2 = Number(second.data.data.complaintId.split('-')[2]);
    assert.equal(seq2, seq1 + 1, 'sequence increments by one');
  });

  test('admin can see all complaints and approve', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });

    const list = await api.get('/api/complaints?pageSize=5');
    assert.equal(list.status, 200);
    assert.ok(list.data.data.length >= 1);
    assert.ok(list.data.meta.pagination.total >= 3, 'admin sees every complaint');

    const approved = await api.post(`/api/complaints/${complaint.id}/approve`, { remarks: 'Verified on site.' });
    assert.equal(approved.status, 200, JSON.stringify(approved.data));
    assert.equal(approved.data.data.status, 'in_progress');
    assert.ok(approved.data.data.approvedAt);
    assert.ok(approved.data.data.history.some((h) => h.newStatus === 'in_progress'), 'status change recorded in history');
  });

  test('admin can assign an officer and the officer is notified', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });

    const officers = await api.get('/api/users/officers');
    assert.equal(officers.status, 200);
    const officer = officers.data.data.find((o) => o.email === OFFICER.email);
    assert.ok(officer, 'seeded officer is listed');

    const assigned = await api.post(`/api/complaints/${complaint.id}/assign`, { officerId: officer.id, notes: 'Please inspect today.' });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.data));
    assert.equal(assigned.data.data.assignedOfficerName, 'Test Officer');
    assert.ok(assigned.data.data.assignment.assignedAt, 'assignment timestamp stored');

    const officerApi = await client();
    await officerApi.post('/api/auth/login', { identifier: OFFICER.email, password: OFFICER.password });
    const notifications = await officerApi.get('/api/notifications');
    assert.ok(
      notifications.data.data.some((n) => n.type === 'complaint_assigned' && n.complaintRef === complaintId),
      'officer received an assignment notification',
    );
  });

  test('officer sees only assigned complaints and can update status + add remarks', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: OFFICER.email, password: OFFICER.password });

    const list = await api.get('/api/complaints');
    assert.ok(list.data.data.length >= 1);
    assert.ok(list.data.data.every((c) => c.assignedOfficerName === 'Test Officer'), 'scoped to assigned complaints');

    const remark = await api.post(`/api/complaints/${complaint.id}/remarks`, { remarks: 'Site inspected, replacement fitting requested from the store.' });
    assert.equal(remark.status, 200, JSON.stringify(remark.data));

    const resolved = await api.put(`/api/complaints/${complaint.id}/status`, {
      status: 'resolved',
      resolutionRemarks: 'LED fitting replaced and the pole is glowing since last night.',
    });
    assert.equal(resolved.status, 200, JSON.stringify(resolved.data));
    assert.equal(resolved.data.data.status, 'resolved');
    assert.ok(resolved.data.data.resolutionDate, 'resolution date recorded');
    assert.equal(resolved.data.data.resolutionRemarks.length > 10, true);
  });

  test('officer cannot resolve a complaint that is not assigned to them', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: OFFICER.email, password: OFFICER.password });
    // NB: `whereNot` alone would drop rows where the column is NULL (SQL three
    // valued logic), so the unassigned complaint must be selected explicitly.
    const other = await db('complaints')
      .whereRaw('COALESCE(assigned_officer_id, -1) != ?', [OFFICER_USER_ID])
      .first();
    const res = await api.put(`/api/complaints/${other.id}/status`, { status: 'resolved', resolutionRemarks: 'Trying to resolve someone else’s work item.' });
    assert.equal(res.status, 403);
  });

  test('citizens cannot change complaint status', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    const res = await api.put(`/api/complaints/${complaint.id}/status`, { status: 'resolved', resolutionRemarks: 'Self approving my own complaint.' });
    assert.equal(res.status, 403);
  });

  test('citizens can track their complaint and see the timeline', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });

    const tracked = await api.get(`/api/complaints/track?complaintId=${complaintId}`);
    assert.equal(tracked.status, 200);
    const result = tracked.data.data[0];
    assert.equal(result.complaintId, complaintId);
    assert.equal(result.status, 'resolved');
    assert.ok(result.history.length >= 4, 'full lifecycle retained');
    const order = result.history.map((h) => h.newStatus);
    assert.equal(order[0], 'pending');
    assert.equal(order[order.length - 1], 'resolved');

    const byRation = await api.get(`/api/complaints/track?rationNumber=${CITIZEN.rationNumber}`);
    assert.equal(byRation.status, 200);
    assert.ok(byRation.data.data.length >= 1, 'searchable by ration number');
  });

  test('citizens cannot read another citizen’s complaint', async () => {
    const outsider = await client();
    await outsider.post('/api/auth/register', {
      name: 'Other Citizen',
      email: 'other.citizen@example.com',
      mobile: '9812345678',
      password: 'Citizen@12345',
      rationNumber: 'TN111222333',
    });
    const res = await outsider.get(`/api/complaints/${complaint.id}`);
    assert.equal(res.status, 403);
  });

  test('rejection requires a reason and notifies the citizen', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });
    const citizenApi = await client();
    await citizenApi.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    const created = await citizenApi.post('/api/complaints', {
      citizenName: CITIZEN.name,
      rationNumber: CITIZEN.rationNumber,
      mobileNumber: CITIZEN.mobile,
      categorySlug: 'other',
      description: 'The public park bench near the temple is broken and needs to be repaired for safety.',
      streetName: 'Temple Street',
      location: 'Ward 1, Temple Street',
      priority: 'low',
    });
    const id = created.data.data.id;

    const withoutReason = await api.put(`/api/complaints/${id}/status`, { status: 'rejected', rejectionReason: 'no' });
    assert.equal(withoutReason.status, 422, 'short rejection reason is refused');

    const rejected = await api.put(`/api/complaints/${id}/status`, {
      status: 'rejected',
      rejectionReason: 'The reported location is outside this village panchayat limit.',
    });
    assert.equal(rejected.status, 200, JSON.stringify(rejected.data));
    assert.equal(rejected.data.data.status, 'rejected');
    assert.equal(rejected.data.data.rejectionReason.includes('outside'), true);

    const citizenNotifications = await citizenApi.get('/api/notifications');
    assert.ok(citizenNotifications.data.data.some((n) => n.type === 'complaint_rejected'));
  });

  test('search, filters, sorting and pagination work', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });

    const byId = await api.get(`/api/complaints?q=${complaintId}`);
    assert.equal(byId.data.data.length, 1);

    const byName = await api.get('/api/complaints?q=Test%20Citizen');
    assert.ok(byName.data.data.length >= 1, 'search by citizen name');

    const byStatus = await api.get('/api/complaints?status=resolved');
    assert.ok(byStatus.data.data.every((c) => c.status === 'resolved'));

    const byPriority = await api.get('/api/complaints?priority=high');
    assert.ok(byPriority.data.data.every((c) => c.priority === 'high'));

    const oldestFirst = await api.get('/api/complaints?sort=oldest&pageSize=5');
    const dates = oldestFirst.data.data.map((c) => new Date(c.complaintDate).getTime());
    assert.deepEqual(dates, [...dates].sort((a, b) => a - b), 'oldest first ordering');

    const paged = await api.get('/api/complaints?page=1&pageSize=2');
    assert.equal(paged.data.meta.pagination.pageSize, 2);
    assert.ok(paged.data.meta.pagination.totalPages >= 2);
  });
});

describe('analytics & reporting', () => {
  test('analytics reflect the complaint data', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });

    const dashboard = await api.get('/api/analytics/dashboard');
    assert.equal(dashboard.status, 200);
    const { kpis, charts } = dashboard.data.data;
    assert.ok(kpis.total >= 4);
    assert.equal(kpis.resolved >= 1, true);
    assert.ok(kpis.resolutionRate > 0 && kpis.resolutionRate <= 100);
    assert.ok(Array.isArray(charts.statuses) && charts.statuses.length === 4);
    assert.ok(Array.isArray(charts.categories) && charts.categories.length >= 1);
    assert.ok(Array.isArray(charts.wards) && charts.wards.length >= 1);
    assert.equal(charts.monthly.series.length, 12);

    const monthly = await api.get('/api/analytics/monthly');
    assert.equal(monthly.data.data.series.length, 12);
    const totalForYear = monthly.data.data.series.reduce((sum, m) => sum + m.total, 0);
    assert.ok(totalForYear >= 4, 'monthly series counts this year’s complaints');
  });

  test('reports build with summary statistics and export as PDF', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });

    const report = await api.get('/api/reports');
    assert.equal(report.status, 200);
    assert.equal(report.data.data.summary.total >= 4, true);
    assert.ok(report.data.data.summary.statusBreakdown.length === 4);
    assert.ok(report.data.data.complaints.length >= 1);
    assert.ok(report.data.data.meta.organisation.includes('Tamil Nadu'));

    const pdf = await api.get('/api/reports/pdf');
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get('content-type'), /application\/pdf/);
    assert.match(pdf.headers.get('content-disposition'), /attachment; filename="VCMS-Complaint-Report-.*\.pdf"/);
    const buffer = Buffer.from(pdf.data);
    assert.ok(buffer.subarray(0, 5).toString() === '%PDF-', 'response is a real PDF document');
    assert.ok(buffer.length > 4000, 'pdf contains rendered content');
  });

  test('report filters narrow the dataset', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });
    const report = await api.get('/api/reports?status=resolved');
    assert.ok(report.data.data.complaints.every((c) => c.status === 'resolved'));

    const empty = await api.get('/api/reports?from=1999-01-01&to=1999-12-31');
    assert.equal(empty.data.data.summary.total, 0);
    assert.equal(empty.data.data.summary.resolutionRate, 0);
  });
});

describe('administration', () => {
  test('categories are database driven and can be deactivated', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });
    const categories = await api.get('/api/categories?withCounts=true');
    assert.equal(categories.data.data.length, 8, 'eight seeded categories');

    const target = categories.data.data.find((c) => c.slug === 'other');
    const deactivated = await api.patch(`/api/categories/${target.id}/status`, { active: false });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.data.data.active, false);

    const publicList = await api.get('/api/categories');
    assert.ok(!publicList.data.data.some((c) => c.id === target.id), 'inactive category hidden from the form');
    await api.patch(`/api/categories/${target.id}/status`, { active: true });
  });

  test('the last active administrator cannot be demoted or deactivated', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });
    const me = await api.get('/api/auth/me');
    const res = await api.put(`/api/users/${me.data.data.user.id}`, { role: 'citizen' });
    assert.equal(res.status, 403, 'cannot change own role');
  });

  test('administrators can create officers and users cannot self-escalate', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });
    const created = await api.post('/api/users', {
      name: 'New Officer',
      email: 'new.officer@vcms.gov.in',
      mobile: '9700011122',
      password: 'Officer@12345',
      role: 'officer',
      designation: 'Ward Officer',
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(created.data.data.role, 'officer');

    const users = await api.get('/api/users?role=officer');
    assert.ok(users.data.data.some((u) => u.email === 'new.officer@vcms.gov.in'));
    assert.equal(users.data.data.some((u) => 'passwordHash' in u), false);
  });

  test('settings and notification preferences persist', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: ADMIN.email, password: ADMIN.password });
    const saved = await api.put('/api/settings', { 'complaint.slaDays': '10' });
    assert.equal(saved.status, 200);
    const settings = await api.get('/api/settings');
    const sla = settings.data.data.settings.find((s) => s.key === 'complaint.slaDays');
    assert.equal(sla.value, '10');

    const citizenApi = await client();
    await citizenApi.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    const prefs = await citizenApi.put('/api/users/me/preferences', { complaintNotifications: false });
    assert.equal(prefs.status, 200);
    assert.equal(prefs.data.data.complaintNotifications, false);
  });

  test('notifications can be marked as read', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    const list = await api.get('/api/notifications');
    assert.ok(list.data.data.length >= 1);
    const unread = list.data.data.find((n) => !n.isRead);
    if (unread) {
      const res = await api.put(`/api/notifications/${unread.id}/read`, { isRead: true });
      assert.equal(res.status, 200);
      assert.equal(res.data.data.isRead, true);
    }
    const all = await api.put('/api/notifications/read-all', {});
    assert.equal(all.status, 200);
    const count = await api.get('/api/notifications/unread-count');
    assert.equal(count.data.data.unreadCount, 0);
  });

  test('session management exposes and revokes sessions', async () => {
    const api = await client();
    await api.post('/api/auth/login', { identifier: CITIZEN.email, password: CITIZEN.password });
    const sessions = await api.get('/api/auth/sessions');
    assert.equal(sessions.status, 200);
    assert.ok(sessions.data.data.length >= 1);
    assert.ok(sessions.data.data.some((s) => s.current));
  });

  test('password change invalidates the session', async () => {
    const api = await client();
    await api.post('/api/auth/register', {
      name: 'Password Tester',
      email: 'password.tester@example.com',
      mobile: '9812340000',
      password: 'Citizen@12345',
      rationNumber: 'TN555444333',
    });
    const bad = await api.post('/api/auth/change-password', { currentPassword: 'WrongPass1', newPassword: 'BrandNew@123' });
    assert.equal(bad.status, 400);

    const good = await api.post('/api/auth/change-password', { currentPassword: 'Citizen@12345', newPassword: 'BrandNew@123' });
    assert.equal(good.status, 200);

    const relogin = await client();
    const oldPassword = await relogin.post('/api/auth/login', { identifier: 'password.tester@example.com', password: 'Citizen@12345' });
    assert.equal(oldPassword.status, 401);
    const newPassword = await relogin.post('/api/auth/login', { identifier: 'password.tester@example.com', password: 'BrandNew@123' });
    assert.equal(newPassword.status, 200);
  });

  test('public endpoints expose branding and statistics without authentication', async () => {
    const api = new ApiClient(baseUrl);
    const branding = await api.get('/api/public/branding');
    assert.equal(branding.data.data.organisation, 'Government of Tamil Nadu');
    const stats = await api.get('/api/public/stats');
    assert.ok(stats.data.data.totalComplaints >= 4);
    assert.ok(stats.data.data.resolutionRate > 0);
  });
});
