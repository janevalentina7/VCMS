/**
 * Complaint service - the heart of the grievance workflow.
 *
 * Responsibilities
 *  - role scoped listing with search / filter / sort / pagination
 *  - transactional complaint creation (atomic reference number + history + notifications)
 *  - the status workflow (§38/§39) including history records and citizen notifications
 *  - officer assignment ledger
 *  - remarks, approval, rejection, deletion
 *
 * Business rules live here (not in controllers) so they can be unit tested and
 * reused by the reporting layer.
 */
import { db, TRUE } from '../db/index.js';
import {
  ROLES,
  STATUS,
  STATUS_LABELS,
  STATUS_EVENT_LABELS,
  PRIORITY_LABELS,
  canTransition,
  TERMINAL_STATUSES,
} from '../config/constants.js';
import { nextComplaintId } from '../utils/complaintId.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { complaintDetail, complaintSummary, history as serializeHistory, assignment as serializeAssignment } from '../utils/serializers.js';
import { logger } from '../utils/logger.js';
import * as notifications from './notificationService.js';
import * as settingsService from './settingsService.js';

const complaintSelect = [
  'c.*',
  'cat.name as category_name',
  'cat.icon as category_icon',
  'cat.colour as category_colour',
  'w.name as ward_name',
  'w.code as ward_code',
  'o.name as officer_name',
  'o.mobile as officer_mobile',
  'o.email as officer_email',
  'cu.email as citizen_email',
  'cu.address as citizen_address',
  'ab.name as assigned_by_name',
  'a.assigned_at as assigned_at',
  'a.assigned_by as assigned_by',
];

const baseQuery = () =>
  db('complaints as c')
    .leftJoin('categories as cat', 'cat.id', 'c.category_id')
    .leftJoin('wards as w', 'w.id', 'c.ward_id')
    .leftJoin('users as o', 'o.id', 'c.assigned_officer_id')
    .leftJoin('users as cu', 'cu.id', 'c.citizen_id')
    // NB: the active assignment must be joined before anything that references
    // it, otherwise SQLite rejects the ON clause ("references tables to its right").
    .leftJoin('officer_assignments as a', function joinActiveAssignment() {
      this.on('a.complaint_id', '=', 'c.id').andOn('a.active', '=', db.raw('?', [TRUE]));
    })
    .leftJoin('users as ab', 'ab.id', 'a.assigned_by')
    .select(complaintSelect);

/** Role based visibility scope. */
const applyScope = (query, user) => {
  if (!user) return query.whereRaw('1 = 0');
  if (user.role === ROLES.ADMIN) return query;
  if (user.role === ROLES.OFFICER) return query.where('c.assigned_officer_id', user.id);
  return query.where('c.citizen_id', user.id);
};

/** Filter builder shared by list + export + analytics drill-down. */
const applyFilters = (query, filters = {}) => {
  const {
    q, status, priority, categoryId, wardId, officerId, citizenId, from, to, mine,
  } = filters;

  if (q) {
    const term = `%${String(q).trim()}%`;
    query.where((builder) => {
      builder
        .whereRaw('LOWER(c.complaint_id) LIKE LOWER(?)', [term])
        .orWhereRaw('LOWER(c.citizen_name) LIKE LOWER(?)', [term])
        .orWhereRaw('LOWER(COALESCE(c.ration_number, \'\')) LIKE LOWER(?)', [term])
        .orWhereRaw('LOWER(c.mobile_number) LIKE LOWER(?)', [term])
        .orWhereRaw('LOWER(c.location) LIKE LOWER(?)', [term])
        .orWhereRaw('LOWER(c.street_name) LIKE LOWER(?)', [term])
        .orWhereRaw('LOWER(c.description) LIKE LOWER(?)', [term])
        .orWhereRaw('LOWER(COALESCE(cat.name, \'\')) LIKE LOWER(?)', [term])
        .orWhereRaw('LOWER(COALESCE(o.name, \'\')) LIKE LOWER(?)', [term]);
    });
  }

  if (status && status !== 'all') {
    if (status === 'open') query.whereIn('c.status', [STATUS.PENDING, STATUS.IN_PROGRESS]);
    else query.where('c.status', status);
  }
  if (priority && priority !== 'all') query.where('c.priority', priority);
  if (categoryId) query.where('c.category_id', categoryId);
  if (wardId) query.where('c.ward_id', wardId);
  if (officerId) query.where('c.assigned_officer_id', officerId);
  if (citizenId) query.where('c.citizen_id', citizenId);
  if (mine === 'true') query.where('c.assigned_officer_id', filters.mineUserId);
  if (from) query.where('c.complaint_date', '>=', new Date(`${from}T00:00:00.000Z`));
  if (to) query.where('c.complaint_date', '<=', new Date(`${to}T23:59:59.999Z`));
  return query;
};

const applySort = (query, sort) => {
  switch (sort) {
    case 'oldest':
      return query.orderBy('c.complaint_date', 'asc').orderBy('c.id', 'asc');
    case 'priority':
      return query
        .orderByRaw(
          "CASE c.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END ASC",
        )
        .orderBy('c.complaint_date', 'desc');
    case 'status':
      return query
        .orderByRaw(
          "CASE c.status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'resolved' THEN 3 ELSE 4 END ASC",
        )
        .orderBy('c.complaint_date', 'desc');
    case 'newest':
    default:
      return query.orderBy('c.complaint_date', 'desc').orderBy('c.id', 'desc');
  }
};

export const listComplaints = async (user, filters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 10));

  const countQuery = applyFilters(
    db('complaints as c')
      .leftJoin('categories as cat', 'cat.id', 'c.category_id')
      .leftJoin('users as o', 'o.id', 'c.assigned_officer_id'),
    { ...filters, mineUserId: user?.id },
  );
  applyScope(countQuery, user);
  const [countRow] = await countQuery.countDistinct({ total: 'c.id' });
  const total = Number(countRow?.total ?? 0);

  const rowsQuery = applyFilters(baseQuery(), { ...filters, mineUserId: user?.id });
  applyScope(rowsQuery, user);
  applySort(rowsQuery, filters.sort).limit(pageSize).offset((page - 1) * pageSize);
  const rows = await rowsQuery;

  return {
    items: rows.map(complaintSummary),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    },
  };
};

/** Fetch raw row with joins, by numeric id or reference. */
export const findComplaintRow = async (idOrRef) => {
  const numeric = Number(idOrRef);
  const query = baseQuery();
  if (Number.isInteger(numeric) && String(idOrRef).trim() !== '' && !String(idOrRef).includes('-')) {
    query.where('c.id', numeric);
  } else {
    query.whereRaw('UPPER(c.complaint_id) = ?', [String(idOrRef).trim().toUpperCase()]);
  }
  return query.first();
};

export const assertCanView = (user, row) => {
  if (!user) throw notFound('Complaint not found.');
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.OFFICER) {
    if (row.assigned_officer_id === user.id) return true;
    throw forbidden('This complaint is not assigned to you.');
  }
  if (row.citizen_id === user.id) return true;
  throw forbidden('You can only view complaints that you have registered.');
};

export const getComplaint = async (user, idOrRef) => {
  const row = await findComplaintRow(idOrRef);
  if (!row) throw notFound('Complaint not found.');
  assertCanView(user, row);

  const [historyRows, assignmentRows] = await Promise.all([
    db('complaint_history as h')
      .leftJoin('users as u', 'u.id', 'h.changed_by')
      .where('h.complaint_id', row.id)
      .orderBy('h.timestamp', 'asc')
      .orderBy('h.id', 'asc')
      .select('h.*', 'u.name as changed_by_name'),
    db('officer_assignments as a')
      .leftJoin('users as o', 'o.id', 'a.officer_id')
      .leftJoin('users as ab', 'ab.id', 'a.assigned_by')
      .where('a.complaint_id', row.id)
      .orderBy('a.assigned_at', 'desc')
      .select('a.*', 'o.name as officer_name', 'ab.name as assigned_by_name'),
  ]);

  return complaintDetail(row, {
    history: historyRows.map(serializeHistory),
    assignments: assignmentRows.map(serializeAssignment),
  });
};

/** Public tracking: reference number or ration number (citizens only). */
export const trackComplaint = async (user, { complaintId, rationNumber }) => {
  if (!complaintId && !rationNumber) {
    throw badRequest('Enter a complaint ID or a ration number to track a complaint.');
  }

  const query = baseQuery();
  if (complaintId) {
    query.whereRaw('UPPER(c.complaint_id) = ?', [String(complaintId).trim().toUpperCase()]);
  } else {
    query.whereRaw('UPPER(COALESCE(c.ration_number, \'\')) = ?', [String(rationNumber).trim().toUpperCase()]);
  }
  // Citizens may only track their own complaints; admins/officers may track any.
  if (user && user.role === ROLES.CITIZEN) query.where('c.citizen_id', user.id);
  else if (!user) query.where('c.id', -1);

  const rows = complaintId ? [await query.first()].filter(Boolean) : await query.orderBy('c.complaint_date', 'desc').limit(25);
  if (!rows.length) throw notFound('No complaint found for the details provided. Please check and try again.');

  const results = [];
  for (const row of rows) {
    const historyRows = await db('complaint_history as h')
      .leftJoin('users as u', 'u.id', 'h.changed_by')
      .where('h.complaint_id', row.id)
      .orderBy('h.timestamp', 'asc')
      .select('h.*', 'u.name as changed_by_name');
    results.push(
      complaintDetail(row, {
        history: historyRows.map(serializeHistory),
      }),
    );
  }
  return results;
};

const writeHistory = async (trx, { complaintId, oldStatus, newStatus, action, changedBy, changedByRole, remarks }) => {
  await trx('complaint_history').insert({
    complaint_id: complaintId,
    old_status: oldStatus ?? null,
    new_status: newStatus ?? null,
    action,
    changed_by: changedBy ?? null,
    changed_by_role: changedByRole ?? null,
    remarks: remarks ?? null,
    timestamp: new Date(),
  });
};

/**
 * Register a complaint. Everything happens in one transaction: the reference
 * number is claimed atomically, the complaint row is inserted, history is
 * written and notifications are queued. If anything fails, nothing is stored.
 */
export const createComplaint = async (user, payload, image = null) => {
  const category = payload.categoryId
    ? await db('categories').where({ id: payload.categoryId }).first()
    : await db('categories').where({ slug: payload.categorySlug }).first();

  if (!category) throw badRequest('Please select a valid complaint category.');
  if (!category.active) throw badRequest(`The category "${category.name}" is currently not accepting new complaints.`);

  let wardId = payload.wardId ?? user.wardId ?? null;
  if (wardId) {
    const ward = await db('wards').where({ id: wardId }).first();
    if (!ward) throw badRequest('Please select a valid ward.');
    if (!ward.active) throw badRequest(`Ward "${ward.name}" is currently inactive.`);
  }

  const complaintDate = payload.complaintDate ? new Date(payload.complaintDate) : new Date();
  const autoApprove = await settingsService.getBoolean('complaint.autoApprove', false);

  const result = await db.transaction(async (trx) => {
    const complaintId = await nextComplaintId(trx);

    const [inserted] = await trx('complaints')
      .insert({
        complaint_id: complaintId,
        citizen_id: user.id,
        category_id: category.id,
        ward_id: wardId,
        citizen_name: payload.citizenName,
        ration_number: payload.rationNumber,
        mobile_number: payload.mobileNumber,
        description: payload.description,
        street_name: payload.streetName,
        area: payload.area ?? null,
        location: payload.location,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        image_url: image?.url ?? null,
        priority: payload.priority,
        status: autoApprove ? STATUS.IN_PROGRESS : STATUS.PENDING,
        assigned_officer_id: null,
        complaint_date: complaintDate,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');

    const id = Array.isArray(inserted) ? (typeof inserted[0] === 'object' ? inserted[0].id : inserted[0]) : inserted?.id ?? inserted;

    await writeHistory(trx, {
      complaintId: id,
      oldStatus: null,
      newStatus: autoApprove ? STATUS.IN_PROGRESS : STATUS.PENDING,
      action: 'created',
      changedBy: user.id,
      changedByRole: user.role,
      remarks: `Complaint registered by ${user.name}.`,
    });

    if (autoApprove) {
      await writeHistory(trx, {
        complaintId: id,
        oldStatus: STATUS.PENDING,
        newStatus: STATUS.IN_PROGRESS,
        action: 'approved',
        changedBy: null,
        changedByRole: 'system',
        remarks: 'Auto-approved by portal configuration.',
      });
    }

    const adminIds = await notifications.userIdsByRole(ROLES.ADMIN, trx);
    const complaintForNotify = {
      id,
      complaint_id: complaintId,
      citizen_id: user.id,
      priority: payload.priority,
      location: payload.location,
    };
    await notifications.notifyComplaintRegistered(trx, complaintForNotify, { admins: adminIds });

    if (autoApprove) {
      const officerIds = await notifications.userIdsByRole(ROLES.OFFICER, trx);
      await notifications.createMany(
        trx,
        officerIds.map((officerId) => ({
          userId: officerId,
          complaintDbId: id,
          complaintRef: complaintId,
          type: 'status_updated',
          title: 'Complaint awaiting assignment',
          message: `Complaint ${complaintId} (${PRIORITY_LABELS[payload.priority]} priority) is ready for assignment.`,
          severity: 'info',
          link: `/complaints/${id}`,
        })),
      );
    }

    return { id, complaintId };
  });

  logger.info(`complaint ${result.complaintId} registered by user ${user.id}`);
  return getComplaint(user, result.id);
};

/** Admin edit of complaint core fields. */
export const updateComplaint = async (user, idOrRef, payload) => {
  const row = await findComplaintRow(idOrRef);
  if (!row) throw notFound('Complaint not found.');
  if (user.role !== ROLES.ADMIN) {
    if (row.citizen_id !== user.id) throw forbidden('You can only edit complaints that you have registered.');
    if (row.status !== STATUS.PENDING) {
      throw forbidden('A complaint can only be edited while it is still pending.');
    }
    const disallowed = ['priority', 'wardId', 'categoryId'].filter((k) => payload[k] !== undefined);
    if (disallowed.length) throw forbidden('Only the village office can change the category, ward or priority of a complaint.');
  }

  const patch = { updated_at: new Date() };
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.streetName !== undefined) patch.street_name = payload.streetName;
  if (payload.area !== undefined) patch.area = payload.area;
  if (payload.location !== undefined) patch.location = payload.location;
  if (payload.mobileNumber !== undefined) patch.mobile_number = payload.mobileNumber;
  if (payload.remarks !== undefined) patch.remarks = payload.remarks;
  if (payload.priority !== undefined) patch.priority = payload.priority;
  if (payload.categoryId !== undefined && payload.categoryId !== null) {
    const category = await db('categories').where({ id: payload.categoryId }).first();
    if (!category) throw badRequest('Please select a valid complaint category.');
    patch.category_id = category.id;
  }
  if (payload.wardId !== undefined && payload.wardId !== null) {
    const ward = await db('wards').where({ id: payload.wardId }).first();
    if (!ward) throw badRequest('Please select a valid ward.');
    patch.ward_id = ward.id;
  }

  await db.transaction(async (trx) => {
    await trx('complaints').where({ id: row.id }).update(patch);
    await writeHistory(trx, {
      complaintId: row.id,
      oldStatus: row.status,
      newStatus: row.status,
      action: 'updated',
      changedBy: user.id,
      changedByRole: user.role,
      remarks: `Complaint details updated by ${user.name}.`,
    });
  });

  return getComplaint(user, row.id);
};

/** Approve a pending complaint (admin only) => moves it to In Progress. */
export const approveComplaint = async (user, idOrRef, remarks) => {
  const row = await findComplaintRow(idOrRef);
  if (!row) throw notFound('Complaint not found.');
  if (row.status !== STATUS.PENDING) {
    throw conflict(`Only complaints with Pending status can be approved. This complaint is currently ${STATUS_LABELS[row.status]}.`);
  }

  await db.transaction(async (trx) => {
    await trx('complaints')
      .where({ id: row.id })
      .update({ status: STATUS.IN_PROGRESS, approved_by: user.id, approved_at: new Date(), updated_at: new Date() });
    await writeHistory(trx, {
      complaintId: row.id,
      oldStatus: STATUS.PENDING,
      newStatus: STATUS.IN_PROGRESS,
      action: 'approved',
      changedBy: user.id,
      changedByRole: user.role,
      remarks: remarks || 'Complaint verified and approved.',
    });
    await notifications.notifyComplaintApproved(trx, row, user.name);
    await notifications.notifyStatusUpdated(trx, row, STATUS.IN_PROGRESS, STATUS_LABELS[STATUS.IN_PROGRESS], user.name);
  });

  return getComplaint(user, row.id);
};

/** Assign (or re-assign) a complaint to a village officer. */
export const assignOfficer = async (user, idOrRef, officerId, notes) => {
  const row = await findComplaintRow(idOrRef);
  if (!row) throw notFound('Complaint not found.');

  const officer = await db('users as u')
    .leftJoin('wards as w', 'w.id', 'u.ward_id')
    .where('u.id', officerId)
    .first('u.*', 'w.name as ward_name');
  if (!officer) throw notFound('The selected officer could not be found.');
  if (officer.role !== ROLES.OFFICER) throw badRequest(`${officer.name} is not a village officer and cannot be assigned complaints.`);
  if (officer.status !== 'active') throw badRequest(`${officer.name} is currently inactive and cannot be assigned new complaints.`);
  if (row.assigned_officer_id === officer.id) {
    throw conflict(`Complaint ${row.complaint_id} is already assigned to ${officer.name}.`);
  }
  if (TERMINAL_STATUSES.includes(row.status)) {
    throw conflict(`Complaint ${row.complaint_id} is ${STATUS_LABELS[row.status]} and cannot be re-assigned.`);
  }

  await db.transaction(async (trx) => {
    const now = new Date();
    await trx('officer_assignments').where({ complaint_id: row.id, active: true }).update({ active: false, unassigned_at: now });
    await trx('officer_assignments').insert({
      complaint_id: row.id,
      officer_id: officer.id,
      assigned_by: user.id,
      assigned_at: now,
      notes: notes ?? null,
      active: true,
    });

    const nextStatus = row.status === STATUS.PENDING ? STATUS.IN_PROGRESS : row.status;
    await trx('complaints')
      .where({ id: row.id })
      .update({ assigned_officer_id: officer.id, status: nextStatus, updated_at: now });

    await writeHistory(trx, {
      complaintId: row.id,
      oldStatus: row.status,
      newStatus: nextStatus,
      action: row.assigned_officer_id ? 'reassigned' : 'assigned',
      changedBy: user.id,
      changedByRole: user.role,
      remarks: notes || `Assigned to ${officer.name}${officer.ward_name ? ` (${officer.ward_name})` : ''}.`,
    });

    if (row.status === STATUS.PENDING) {
      await writeHistory(trx, {
        complaintId: row.id,
        oldStatus: STATUS.PENDING,
        newStatus: STATUS.IN_PROGRESS,
        action: 'status:in_progress',
        changedBy: user.id,
        changedByRole: user.role,
        remarks: 'Work started after officer assignment.',
      });
    }

    await notifications.notifyComplaintAssigned(trx, row, officer);
  });

  logger.info(`complaint ${row.complaint_id} assigned to officer ${officer.id} by ${user.id}`);
  return getComplaint(user, row.id);
};

/** Generic status transition (admin + assigned officer). */
export const changeStatus = async (user, idOrRef, payload) => {
  const row = await findComplaintRow(idOrRef);
  if (!row) throw notFound('Complaint not found.');
  const newStatus = payload.status;
  const label = STATUS_LABELS[newStatus];

  if (user.role === ROLES.OFFICER && row.assigned_officer_id !== user.id) {
    throw forbidden('You can only update complaints assigned to you.');
  }
  if (user.role === ROLES.CITIZEN) throw forbidden('Citizens cannot change the status of a complaint.');

  if (row.status === newStatus) {
    throw conflict(`Complaint ${row.complaint_id} already has the status "${label}".`);
  }
  if (!canTransition(user.role, row.status, newStatus)) {
    const allowed = (user.role === ROLES.ADMIN
      ? ['pending', 'in_progress', 'resolved', 'rejected']
      : ['in_progress', 'resolved']
    ).filter((s) => s !== row.status && canTransition(user.role, row.status, s));
    throw badRequest(
      `A complaint with status "${STATUS_LABELS[row.status]}" cannot be moved to "${label}".` +
        (allowed.length ? ` Allowed next status: ${allowed.map((s) => STATUS_LABELS[s]).join(', ')}.` : ''),
    );
  }
  if (newStatus === STATUS.RESOLVED && !row.assigned_officer_id && user.role === ROLES.OFFICER) {
    throw forbidden('This complaint is not assigned to you.');
  }

  const remarks = payload.remarks ?? payload.resolutionRemarks ?? payload.rejectionReason ?? null;
  const action = STATUS_EVENT_LABELS[`status:${newStatus}`] ? `status:${newStatus}` : 'updated';

  await db.transaction(async (trx) => {
    const patch = { status: newStatus, updated_at: new Date() };
    if (remarks) patch.remarks = remarks;
    if (newStatus === STATUS.RESOLVED) {
      patch.resolution_date = new Date();
      patch.resolved_by = user.id;
      patch.resolution_remarks = payload.resolutionRemarks ?? remarks ?? null;
    }
    if (newStatus === STATUS.REJECTED) {
      patch.rejection_reason = payload.rejectionReason ?? remarks;
      patch.rejected_by = user.id;
    }
    if (newStatus === STATUS.IN_PROGRESS) {
      patch.resolution_date = null;
      patch.resolved_by = null;
    }

    await trx('complaints').where({ id: row.id }).update(patch);
    await writeHistory(trx, {
      complaintId: row.id,
      oldStatus: row.status,
      newStatus,
      action,
      changedBy: user.id,
      changedByRole: user.role,
      remarks: remarks || `Status changed from ${STATUS_LABELS[row.status]} to ${label}.`,
    });
    await notifications.notifyStatusUpdated(trx, row, newStatus, label, user.name);
  });

  return getComplaint(user, row.id);
};

/** Add a remark without changing status. */
export const addRemark = async (user, idOrRef, remarks, status) => {
  const row = await findComplaintRow(idOrRef);
  if (!row) throw notFound('Complaint not found.');
  if (user.role === ROLES.CITIZEN) throw forbidden('Citizens cannot add remarks to a complaint. Please use the tracking page to follow updates.');
  if (user.role === ROLES.OFFICER && row.assigned_officer_id !== user.id) {
    throw forbidden('You can only add remarks to complaints assigned to you.');
  }

  await db.transaction(async (trx) => {
    await trx('complaints')
      .where({ id: row.id })
      .update({
        remarks,
        ...(row.status === STATUS.IN_PROGRESS ? {} : {}),
        updated_at: new Date(),
      });
    await writeHistory(trx, {
      complaintId: row.id,
      oldStatus: row.status,
      newStatus: row.status,
      action: 'remark',
      changedBy: user.id,
      changedByRole: user.role,
      remarks,
    });
    await notifications.notifyRemarkAdded(trx, row, user.name, remarks);
  });

  return getComplaint(user, row.id);
};

export const deleteComplaint = async (user, idOrRef) => {
  const row = await findComplaintRow(idOrRef);
  if (!row) throw notFound('Complaint not found.');
  if (user.role !== ROLES.ADMIN) {
    if (row.citizen_id !== user.id) throw forbidden('You can only delete complaints that you have registered.');
    if (row.status !== STATUS.PENDING) throw forbidden('A complaint can only be withdrawn while it is still pending.');
  }
  await db('complaints').where({ id: row.id }).del();
  logger.info(`complaint ${row.complaint_id} deleted by user ${user.id}`);
  return { id: row.id, complaintId: row.complaint_id };
};

export const getHistory = async (user, idOrRef) => {
  const row = await findComplaintRow(idOrRef);
  if (!row) throw notFound('Complaint not found.');
  assertCanView(user, row);
  const rows = await db('complaint_history as h')
    .leftJoin('users as u', 'u.id', 'h.changed_by')
    .where('h.complaint_id', row.id)
    .orderBy('h.timestamp', 'asc')
    .select('h.*', 'u.name as changed_by_name');
  return { complaintId: row.complaint_id, complaintDbId: row.id, history: rows.map(serializeHistory) };
};

/** Status tallies honouring the caller's scope (used by dashboards). */
export const countsByStatus = async (user, filters = {}) => {
  const query = applyFilters(
    db('complaints as c').leftJoin('categories as cat', 'cat.id', 'c.category_id').leftJoin('users as o', 'o.id', 'c.assigned_officer_id'),
    { ...filters, mineUserId: user?.id },
  );
  applyScope(query, user);
  const rows = await query.groupBy('c.status').select('c.status').count({ total: 'c.id' });

  const counts = { pending: 0, in_progress: 0, resolved: 0, rejected: 0, total: 0 };
  rows.forEach((r) => {
    counts[r.status] = Number(r.total);
    counts.total += Number(r.total);
  });
  return counts;
};

/** Officer workload count (used when listing officers for assignment). */
export const officerWorkload = async () => {
  const rows = await db('complaints')
    .whereIn('status', [STATUS.PENDING, STATUS.IN_PROGRESS])
    .whereNotNull('assigned_officer_id')
    .groupBy('assigned_officer_id')
    .select('assigned_officer_id')
    .count({ total: 'id' });
  return rows.reduce((acc, r) => ({ ...acc, [r.assigned_officer_id]: Number(r.total) }), {});
};

export default {
  listComplaints,
  getComplaint,
  createComplaint,
  updateComplaint,
  approveComplaint,
  assignOfficer,
  changeStatus,
  addRemark,
  deleteComplaint,
  getHistory,
  trackComplaint,
  countsByStatus,
  officerWorkload,
  findComplaintRow,
};
