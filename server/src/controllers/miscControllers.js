/** Category, ward, notification, analytics, report and settings controllers. */
import { asyncHandler, sendOk, sendCreated } from '../utils/http.js';
import * as categoryService from '../services/categoryService.js';
import * as wardService from '../services/wardService.js';
import * as notificationService from '../services/notificationService.js';
import * as analyticsService from '../services/analyticsService.js';
import * as reportService from '../services/reportService.js';
import * as settingsService from '../services/settingsService.js';
import { recordAudit } from '../middleware/audit.js';

// ── Categories ──────────────────────────────────────────────────────────────
export const listCategories = asyncHandler(async (req, res) => {
  const includeInactive = req.user?.role === 'admin' && String(req.query.includeInactive) === 'true';
  const withCounts = String(req.query.withCounts) === 'true' && req.user?.role === 'admin';
  return sendOk(res, await categoryService.list({ includeInactive, withCounts }));
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.create(req.body);
  await recordAudit({ userId: req.user.id, action: 'category.create', entity: 'categories', entityId: category.id, ip: req.ip });
  return sendCreated(res, category, `Category "${category.name}" has been created.`);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.update(Number(req.params.id), req.body);
  await recordAudit({ userId: req.user.id, action: 'category.update', entity: 'categories', entityId: category.id, ip: req.ip });
  return sendOk(res, category, 'Category updated successfully.');
});

export const setCategoryStatus = asyncHandler(async (req, res) => {
  const category = await categoryService.setActive(Number(req.params.id), req.body.active);
  await recordAudit({
    userId: req.user.id,
    action: category.active ? 'category.activate' : 'category.deactivate',
    entity: 'categories',
    entityId: category.id,
    ip: req.ip,
  });
  return sendOk(res, category, `Category "${category.name}" is now ${category.active ? 'active' : 'inactive'}.`);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.remove(Number(req.params.id));
  await recordAudit({ userId: req.user.id, action: 'category.delete', entity: 'categories', entityId: result.id, ip: req.ip });
  return sendOk(res, result, `Category "${result.name}" has been deleted.`);
});

// ── Wards ───────────────────────────────────────────────────────────────────
export const listWards = asyncHandler(async (req, res) => {
  const includeInactive = req.user?.role === 'admin' && String(req.query.includeInactive) === 'true';
  const withCounts = req.user?.role === 'admin' && String(req.query.withCounts) === 'true';
  return sendOk(res, await wardService.list({ includeInactive, withCounts }));
});

export const createWard = asyncHandler(async (req, res) => {
  const ward = await wardService.create(req.body);
  await recordAudit({ userId: req.user.id, action: 'ward.create', entity: 'wards', entityId: ward.id, ip: req.ip });
  return sendCreated(res, ward, `Ward "${ward.name}" has been created.`);
});

export const updateWard = asyncHandler(async (req, res) => {
  const ward = await wardService.update(Number(req.params.id), req.body);
  await recordAudit({ userId: req.user.id, action: 'ward.update', entity: 'wards', entityId: ward.id, ip: req.ip });
  return sendOk(res, ward, 'Ward updated successfully.');
});

// ── Notifications ───────────────────────────────────────────────────────────
export const listNotifications = asyncHandler(async (req, res) => {
  const query = req.validatedQuery ?? req.query;
  const result = await notificationService.listNotifications(req.user.id, {
    unreadOnly: query.unreadOnly === 'true',
    page: query.page,
    pageSize: query.pageSize,
  });
  return sendOk(res, result.items, undefined, {
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    },
    unreadCount: result.unreadCount,
  });
});

export const unreadCount = asyncHandler(async (req, res) => {
  return sendOk(res, { unreadCount: await notificationService.unreadCount(req.user.id) });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const row = await notificationService.markRead(req.user.id, Number(req.params.id), req.body?.isRead !== false);
  if (!row) return sendOk(res, null, 'Notification not found.');
  return sendOk(res, row, req.body?.isRead === false ? 'Marked as unread.' : 'Marked as read.');
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const count = await notificationService.markAllRead(req.user.id);
  return sendOk(res, { updated: count }, count ? `${count} notification(s) marked as read.` : 'No unread notifications.');
});

// ── Analytics ───────────────────────────────────────────────────────────────
export const analyticsDashboard = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.dashboard(req.user, req.validatedQuery ?? req.query));
});

export const analyticsSummary = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.summary(req.user, req.validatedQuery ?? req.query));
});

export const analyticsCategories = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.byCategory(req.user, req.validatedQuery ?? req.query));
});

export const analyticsMonthly = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.monthly(req.user, req.validatedQuery ?? req.query));
});

export const analyticsStatus = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.byStatus(req.user, req.validatedQuery ?? req.query));
});

export const analyticsWards = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.byWard(req.user, req.validatedQuery ?? req.query));
});

export const analyticsPriority = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.byPriority(req.user, req.validatedQuery ?? req.query));
});

export const analyticsOfficers = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.officerPerformance(req.user, req.validatedQuery ?? req.query));
});

export const analyticsRecent = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.recentActivity(req.user, Number(req.query.limit) || 8));
});

export const officerSummary = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.officerSummary(req.user, req.validatedQuery ?? req.query));
});

export const citizenSummary = asyncHandler(async (req, res) => {
  return sendOk(res, await analyticsService.citizenSummary(req.user));
});

// ── Reports ─────────────────────────────────────────────────────────────────
export const getReport = asyncHandler(async (req, res) => {
  const report = await reportService.buildReport(req.user, req.validatedQuery ?? req.query);
  return sendOk(res, report);
});

export const downloadReportPdf = asyncHandler(async (req, res) => {
  const report = await reportService.buildReport(req.user, req.validatedQuery ?? req.query);
  const stamp = new Date().toISOString().slice(0, 10);
  await recordAudit({ userId: req.user.id, action: 'report.pdf', entity: 'reports', meta: report.filters, ip: req.ip });
  return reportService.streamPdf(report, res, { filename: `VCMS-Complaint-Report-${stamp}.pdf` });
});

// ── Settings ────────────────────────────────────────────────────────────────
export const getSettings = asyncHandler(async (_req, res) => {
  return sendOk(res, { settings: await settingsService.all(), grouped: await settingsService.grouped() });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const updated = await settingsService.updateMany(req.body.settings ?? req.body);
  await recordAudit({ userId: req.user.id, action: 'settings.update', entity: 'settings', meta: updated, ip: req.ip });
  return sendOk(res, { updated }, 'Application settings saved successfully.');
});

export const publicBranding = asyncHandler(async (_req, res) => {
  return sendOk(res, await settingsService.branding());
});

export const publicStats = asyncHandler(async (_req, res) => {
  const [complaints, users, categories] = await Promise.all([
    import('../db/index.js').then(({ db }) => db('complaints').select('status').count({ total: 'id' }).groupBy('status')),
    import('../db/index.js').then(({ db }) => db('users').where({ role: 'citizen' }).count({ total: 'id' }).first()),
    import('../db/index.js').then(({ db }) => db('categories').where({ active: true }).count({ total: 'id' }).first()),
  ]);
  const counts = complaints.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total) }), {});
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return sendOk(res, {
    totalComplaints: total,
    resolved: counts.resolved ?? 0,
    inProgress: counts.in_progress ?? 0,
    pending: counts.pending ?? 0,
    rejected: counts.rejected ?? 0,
    resolutionRate: total ? Number((((counts.resolved ?? 0) / total) * 100).toFixed(1)) : 0,
    citizens: Number(users?.total ?? 0),
    categories: Number(categories?.total ?? 0),
  });
});

export default {
  listCategories,
  createCategory,
  updateCategory,
  setCategoryStatus,
  deleteCategory,
  listWards,
  createWard,
  updateWard,
  listNotifications,
  unreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  analyticsDashboard,
  analyticsSummary,
  analyticsCategories,
  analyticsMonthly,
  analyticsStatus,
  analyticsWards,
  analyticsPriority,
  analyticsOfficers,
  analyticsRecent,
  officerSummary,
  citizenSummary,
  getReport,
  downloadReportPdf,
  getSettings,
  updateSettings,
  publicBranding,
  publicStats,
};
