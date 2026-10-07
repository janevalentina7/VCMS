/**
 * Analytics & KPI service.
 *
 * Month bucketing is done in JavaScript rather than with dialect specific SQL
 * date functions, which keeps one implementation working identically on SQLite
 * and PostgreSQL. All other aggregations are executed in the database.
 */
import { db, asIso } from '../db/index.js';
import { ROLES, STATUS, PRIORITY, STATUS_LABELS, PRIORITY_LABELS, TERMINAL_STATUSES } from '../config/constants.js';
import { MONTH_LABELS } from '../utils/datetime.js';
import { applyComplaintScope } from './scope.js';

const filtersSql = (query, f = {}) => {
  if (f.from) query.where('c.complaint_date', '>=', new Date(`${f.from}T00:00:00.000Z`));
  if (f.to) query.where('c.complaint_date', '<=', new Date(`${f.to}T23:59:59.999Z`));
  if (f.wardId) query.where('c.ward_id', f.wardId);
  if (f.categoryId) query.where('c.category_id', f.categoryId);
  return query;
};

const base = (user, filters) => {
  const q = db('complaints as c')
    .leftJoin('categories as cat', 'cat.id', 'c.category_id')
    .leftJoin('wards as w', 'w.id', 'c.ward_id')
    .leftJoin('users as o', 'o.id', 'c.assigned_officer_id');
  applyComplaintScope(q, user);
  return filtersSql(q, filters);
};

/** Headline numbers + period-over-period trend for the dashboard cards. */
export const summary = async (user, filters = {}) => {
  const rows = await base(user, filters).select('c.id', 'c.status', 'c.priority', 'c.complaint_date', 'c.resolution_date');
  const totals = { total: rows.length, pending: 0, in_progress: 0, resolved: 0, rejected: 0 };
  const priority = { low: 0, medium: 0, high: 0, critical: 0 };
  let resolutionDays = 0;
  let resolvedCount = 0;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  let thisMonth = 0;
  let lastMonth = 0;

  rows.forEach((r) => {
    totals[r.status] = (totals[r.status] || 0) + 1;
    priority[r.priority] = (priority[r.priority] || 0) + 1;
    const created = new Date(asIso(r.complaint_date) || 0);
    if (created >= monthStart) thisMonth += 1;
    else if (created >= prevMonthStart) lastMonth += 1;
    if (r.status === STATUS.RESOLVED && r.resolution_date) {
      const diff = (new Date(asIso(r.resolution_date)) - created) / 86400000;
      if (Number.isFinite(diff) && diff >= 0) {
        resolutionDays += diff;
        resolvedCount += 1;
      }
    }
  });

  const pct = (value, total) => (total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0);
  const growth = lastMonth === 0 ? (thisMonth > 0 ? 100 : 0) : Number((((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1));

  return {
    ...totals,
    priority,
    resolutionRate: pct(totals.resolved, totals.total),
    pendingRate: pct(totals.pending, totals.total),
    rejectionRate: pct(totals.rejected, totals.total),
    inProgressRate: pct(totals.in_progress, totals.total),
    averageResolutionDays: resolvedCount ? Number((resolutionDays / resolvedCount).toFixed(1)) : 0,
    resolvedCount,
    thisMonth,
    lastMonth,
    monthlyGrowth: growth,
  };
};

export const byCategory = async (user, filters = {}) => {
  const rows = await base(user, filters)
    .groupBy('c.category_id', 'cat.name', 'cat.colour', 'cat.icon')
    .select('c.category_id', 'cat.name', 'cat.colour', 'cat.icon')
    .count({ total: 'c.id' });
  const total = rows.reduce((sum, r) => sum + Number(r.total), 0);
  return rows
    .map((r) => ({
      categoryId: r.category_id,
      category: r.name ?? 'Uncategorised',
      colour: r.colour ?? '#475569',
      icon: r.icon ?? 'CircleAlert',
      count: Number(r.total),
      percentage: total ? Number(((Number(r.total) / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
};

export const monthly = async (user, filters = {}) => {
  const year = Number(filters.year) || new Date().getFullYear();
  const rows = await base(user, { ...filters, from: `${year}-01-01`, to: `${year}-12-31` }).select(
    'c.complaint_date',
    'c.status',
    'c.resolution_date',
  );

  const buckets = MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    year,
    total: 0,
    resolved: 0,
    rejected: 0,
    pending: 0,
    inProgress: 0,
  }));

  rows.forEach((r) => {
    const d = new Date(asIso(r.complaint_date) || 0);
    if (Number.isNaN(d.getTime())) return;
    const bucket = buckets[d.getUTCMonth()];
    if (!bucket) return;
    bucket.total += 1;
    if (r.status === STATUS.RESOLVED) bucket.resolved += 1;
    else if (r.status === STATUS.REJECTED) bucket.rejected += 1;
    else if (r.status === STATUS.IN_PROGRESS) bucket.inProgress += 1;
    else bucket.pending += 1;
  });

  const years = await availableYears(user);
  return { year, years, series: buckets };
};

export const availableYears = async (user) => {
  const q = db('complaints as c').select('c.complaint_date');
  applyComplaintScope(q, user);
  const rows = await q;
  const years = new Set(rows.map((r) => new Date(asIso(r.complaint_date) || 0).getUTCFullYear()).filter(Boolean));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
};

export const byStatus = async (user, filters = {}) => {
  const rows = await base(user, filters).groupBy('c.status').select('c.status').count({ total: 'c.id' });
  const total = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const counts = rows.reduce((a, r) => ({ ...a, [r.status]: Number(r.total) }), {});
  const order = [STATUS.RESOLVED, STATUS.PENDING, STATUS.IN_PROGRESS, STATUS.REJECTED];
  const colours = {
    resolved: '#15803d',
    pending: '#d97706',
    in_progress: '#0284c7',
    rejected: '#b91c1c',
  };
  return order.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: counts[status] ?? 0,
    colour: colours[status],
    percentage: total ? Number((((counts[status] ?? 0) / total) * 100).toFixed(1)) : 0,
  }));
};

export const byWard = async (user, filters = {}) => {
  const rows = await base(user, filters)
    .groupBy('c.ward_id', 'w.name', 'w.code')
    .select('c.ward_id', 'w.name', 'w.code')
    .count({ total: 'c.id' });
  const resolved = await base(user, filters)
    .where('c.status', STATUS.RESOLVED)
    .groupBy('c.ward_id')
    .select('c.ward_id')
    .count({ total: 'c.id' });
  const resolvedMap = resolved.reduce((a, r) => ({ ...a, [r.ward_id]: Number(r.total) }), {});

  const wards = await db('wards').where({ active: true }).orderBy('code').select('id', 'name', 'code');
  const map = rows.reduce((a, r) => ({ ...a, [r.ward_id]: Number(r.total) }), {});
  const list = wards.map((w) => ({
    wardId: w.id,
    ward: w.name,
    code: w.code,
    count: map[w.id] ?? 0,
    resolved: resolvedMap[w.id] ?? 0,
  }));
  const unassigned = rows.find((r) => r.ward_id === null);
  if (unassigned) list.push({ wardId: null, ward: 'Unassigned', code: '—', count: Number(unassigned.total), resolved: 0 });
  return list;
};

export const byPriority = async (user, filters = {}) => {
  const rows = await base(user, filters).groupBy('c.priority').select('c.priority').count({ total: 'c.id' });
  const map = rows.reduce((a, r) => ({ ...a, [r.priority]: Number(r.total) }), {});
  const colours = { low: '#15803d', medium: '#0284c7', high: '#d97706', critical: '#b91c1c' };
  return Object.values(PRIORITY).map((p) => ({
    priority: p,
    label: PRIORITY_LABELS[p],
    count: map[p] ?? 0,
    colour: colours[p],
  }));
};

/** Officers ranked by resolution performance (admin insight). */
export const officerPerformance = async (user, filters = {}) => {
  const rows = await base(user, filters)
    .whereNotNull('c.assigned_officer_id')
    .groupBy('c.assigned_officer_id', 'o.name', 'w.name')
    .select('c.assigned_officer_id', 'o.name as officer_name', 'w.name as ward_name')
    .count({ total: 'c.id' });
  const resolvedRows = await base(user, filters)
    .whereNotNull('c.assigned_officer_id')
    .where('c.status', STATUS.RESOLVED)
    .groupBy('c.assigned_officer_id')
    .select('c.assigned_officer_id')
    .count({ total: 'c.id' });
  const resolvedMap = resolvedRows.reduce((a, r) => ({ ...a, [r.assigned_officer_id]: Number(r.total) }), {});

  return rows
    .map((r) => {
      const total = Number(r.total);
      const done = resolvedMap[r.assigned_officer_id] ?? 0;
      return {
        officerId: r.assigned_officer_id,
        officer: r.officer_name ?? 'Unassigned',
        ward: r.ward_name ?? '—',
        assigned: total,
        resolved: done,
        resolutionRate: total ? Number(((done / total) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.resolved - a.resolved);
};

/** Recent activity feed (used on dashboards). */
export const recentActivity = async (user, limit = 8) => {
  const rows = await base(user, {})
    .orderBy('c.complaint_date', 'desc')
    .limit(limit)
    .select(
      'c.id',
      'c.complaint_id',
      'c.status',
      'c.priority',
      'c.complaint_date',
      'cat.name as category_name',
      'c.location',
      'c.citizen_name',
    );
  return rows.map((r) => ({
    id: r.id,
    complaintId: r.complaint_id,
    status: r.status,
    statusLabel: STATUS_LABELS[r.status],
    priority: r.priority,
    category: r.category_name,
    location: r.location,
    citizenName: r.citizen_name,
    date: asIso(r.complaint_date),
  }));
};

/** Everything the analytics page needs in one round trip. */
export const dashboard = async (user, filters = {}) => {
  const [totals, categories, statuses, wards, priorities] = await Promise.all([
    summary(user, filters),
    byCategory(user, filters),
    byStatus(user, filters),
    byWard(user, filters),
    byPriority(user, filters),
  ]);
  const year = Number(filters.year) || new Date().getFullYear();
  const monthlyData = await monthly(user, { ...filters, year });
  const common = categories[0] ?? null;
  const topWard = [...wards].sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    kpis: {
      ...totals,
      mostCommonCategory: common ? { name: common.category, count: common.count, percentage: common.percentage } : null,
      highestComplaintWard: topWard ? { name: topWard.ward, code: topWard.code, count: topWard.count } : null,
    },
    charts: {
      categories,
      statuses,
      wards,
      priorities,
      monthly: monthlyData,
    },
    scope: user.role,
  };
};

/** Officer dashboard cards (§16). */
export const officerSummary = async (officer, filters = {}) => {
  const totals = await summary(officer, filters);
  const highPriority = await base(officer, filters)
    .whereIn('c.priority', [PRIORITY.HIGH, PRIORITY.CRITICAL])
    .whereNotIn('c.status', TERMINAL_STATUSES)
    .count({ total: 'c.id' });
  const overdue = await base(officer, filters)
    .where('c.status', STATUS.IN_PROGRESS)
    .where('c.complaint_date', '<', new Date(Date.now() - 7 * 86400000))
    .count({ total: 'c.id' });
  return {
    assigned: totals.total,
    pending: totals.pending,
    inProgress: totals.in_progress,
    resolved: totals.resolved,
    rejected: totals.rejected,
    highPriority: Number(highPriority[0]?.total ?? 0),
    overdue: Number(overdue[0]?.total ?? 0),
    resolutionRate: totals.resolutionRate,
    averageResolutionDays: totals.averageResolutionDays,
    thisMonth: totals.thisMonth,
    monthlyGrowth: totals.monthlyGrowth,
  };
};

/** Citizen dashboard cards (§6). */
export const citizenSummary = async (citizen) => {
  const totals = await summary(citizen, {});
  return {
    total: totals.total,
    pending: totals.pending,
    inProgress: totals.in_progress,
    resolved: totals.resolved,
    rejected: totals.rejected,
    thisMonth: totals.thisMonth,
    monthlyGrowth: totals.monthlyGrowth,
  };
};

export default {
  summary,
  byCategory,
  monthly,
  byStatus,
  byWard,
  byPriority,
  officerPerformance,
  recentActivity,
  dashboard,
  officerSummary,
  citizenSummary,
};
