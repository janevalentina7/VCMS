/**
 * User management (administrators) + self-service profile operations.
 *
 * Guard rails enforced here:
 *  - a user can never change their own role (§21)
 *  - an administrator cannot deactivate or delete their own account
 *  - the last remaining active administrator cannot be deactivated or deleted
 *  - users that own complaints are deactivated rather than hard-deleted
 */
import { db } from '../db/index.js';
import { ROLES, ROLE_LABELS, STATUS } from '../config/constants.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { publicUser, selfUser } from '../utils/serializers.js';
import { hashPassword } from './authService.js';
import { removeUpload } from '../middleware/upload.js';
import { logger } from '../utils/logger.js';

const baseUserQuery = () =>
  db('users as u')
    .leftJoin('wards as w', 'w.id', 'u.ward_id')
    .select('u.*', 'w.name as ward_name', 'w.code as ward_code');

export const list = async (filters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 10));

  const apply = (q) => {
    if (filters.q) {
      const term = `%${filters.q}%`;
      q.where((b) =>
        b
          .whereRaw('LOWER(u.name) LIKE LOWER(?)', [term])
          .orWhereRaw('LOWER(u.email) LIKE LOWER(?)', [term])
          .orWhereRaw('LOWER(u.mobile) LIKE LOWER(?)', [term])
          .orWhereRaw("LOWER(COALESCE(u.ration_number, '')) LIKE LOWER(?)", [term])
          .orWhereRaw("LOWER(COALESCE(w.name, '')) LIKE LOWER(?)", [term]),
      );
    }
    if (filters.role && filters.role !== 'all') q.where('u.role', filters.role);
    if (filters.status && filters.status !== 'all') q.where('u.status', filters.status);
    if (filters.wardId) q.where('u.ward_id', filters.wardId);
    return q;
  };

  const [countRow] = await apply(db('users as u').leftJoin('wards as w', 'w.id', 'u.ward_id')).count({ total: 'u.id' });
  const total = Number(countRow?.total ?? 0);

  const rows = await apply(baseUserQuery())
    .orderBy('u.created_at', filters.sort === 'oldest' ? 'asc' : 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Complaint volumes make the user table far more useful for administrators.
  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db('complaints').whereIn('citizen_id', ids).groupBy('citizen_id').select('citizen_id').count({ total: 'id' })
    : [];
  const assigned = ids.length
    ? await db('complaints')
        .whereIn('assigned_officer_id', ids)
        .whereIn('status', [STATUS.PENDING, STATUS.IN_PROGRESS])
        .groupBy('assigned_officer_id')
        .select('assigned_officer_id')
        .count({ total: 'id' })
    : [];
  const complaintMap = counts.reduce((a, r) => ({ ...a, [r.citizen_id]: Number(r.total) }), {});
  const assignedMap = assigned.reduce((a, r) => ({ ...a, [r.assigned_officer_id]: Number(r.total) }), {});

  return {
    items: rows.map((row) => ({
      ...publicUser(row),
      complaintCount: complaintMap[row.id] ?? 0,
      activeAssignments: assignedMap[row.id] ?? 0,
    })),
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

export const getById = async (id) => {
  const row = await baseUserQuery().where('u.id', id).first();
  if (!row) throw notFound('User not found.');
  return publicUser(row);
};

export const findById = async (id) => baseUserQuery().where('u.id', id).first();

export const create = async (payload) => {
  const email = payload.email.toLowerCase();
  const clash = await db('users').where({ email }).orWhere({ mobile: payload.mobile }).first();
  if (clash) {
    throw conflict(
      clash.email === email
        ? 'A user with this email address already exists.'
        : 'A user with this mobile number already exists.',
    );
  }
  if (payload.rationNumber) {
    const rationClash = await db('users').where({ ration_number: payload.rationNumber }).first();
    if (rationClash) throw conflict('This ration number is already linked to another account.');
  }
  if (payload.role === ROLES.CITIZEN && !payload.rationNumber) {
    // Ration number is how citizens are verified in the field - warn but allow.
    logger.debug('citizen created without a ration number');
  }

  const [{ id }] = await db('users')
    .insert({
      name: payload.name,
      email,
      mobile: payload.mobile,
      password_hash: await hashPassword(payload.password),
      ration_number: payload.rationNumber ?? null,
      role: payload.role,
      ward_id: payload.wardId ?? null,
      address: payload.address ?? null,
      designation: payload.designation ?? (payload.role === ROLES.OFFICER ? 'Village Officer' : null),
      status: payload.status ?? 'active',
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('id');

  const userId = typeof id === 'object' ? id.id : id;
  await db('notification_preferences')
    .insert({ user_id: userId, complaint_notifications: true, assignment_notifications: true, resolution_notifications: true })
    .onConflict('user_id')
    .ignore();

  logger.info(`user created: ${email} (${ROLE_LABELS[payload.role]})`);
  return getById(userId);
};

const activeAdminCount = async (excludingId = null) => {
  const q = db('users').where({ role: ROLES.ADMIN, status: 'active' });
  if (excludingId) q.whereNot({ id: excludingId });
  const [row] = await q.count({ c: '*' });
  return Number(row?.c ?? 0);
};

export const update = async (id, payload, actor) => {
  const target = await db('users').where({ id }).first();
  if (!target) throw notFound('User not found.');

  const patch = { updated_at: new Date() };

  if (payload.role !== undefined && payload.role !== target.role) {
    if (actor && actor.id === target.id) {
      throw forbidden('You cannot change your own role. Ask another administrator to do it for you.');
    }
    if (target.role === ROLES.ADMIN && (await activeAdminCount(target.id)) === 0) {
      throw conflict('The last active administrator cannot be demoted.');
    }
    patch.role = payload.role;
    logger.info(`role change: user ${id} ${target.role} -> ${payload.role} by ${actor?.email}`);
  }

  if (payload.status !== undefined && payload.status !== target.status) {
    if (actor && actor.id === target.id) throw forbidden('You cannot change the status of your own account.');
    if (target.role === ROLES.ADMIN && payload.status !== 'active' && (await activeAdminCount(target.id)) === 0) {
      throw conflict('The last active administrator cannot be deactivated.');
    }
    patch.status = payload.status;
  }

  if (payload.email !== undefined && payload.email.toLowerCase() !== target.email) {
    const clash = await db('users').where({ email: payload.email.toLowerCase() }).whereNot({ id }).first();
    if (clash) throw conflict('A user with this email address already exists.');
    patch.email = payload.email.toLowerCase();
  }
  if (payload.mobile !== undefined && payload.mobile !== target.mobile) {
    const clash = await db('users').where({ mobile: payload.mobile }).whereNot({ id }).first();
    if (clash) throw conflict('A user with this mobile number already exists.');
    patch.mobile = payload.mobile;
  }
  if (payload.rationNumber !== undefined) {
    if (payload.rationNumber) {
      const clash = await db('users').where({ ration_number: payload.rationNumber }).whereNot({ id }).first();
      if (clash) throw conflict('This ration number is already linked to another account.');
    }
    patch.ration_number = payload.rationNumber;
  }
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.wardId !== undefined) patch.ward_id = payload.wardId;
  if (payload.address !== undefined) patch.address = payload.address;
  if (payload.designation !== undefined) patch.designation = payload.designation;

  await db('users').where({ id }).update(patch);
  return getById(id);
};

export const setStatus = async (id, status, actor) => update(id, { status }, actor);

export const remove = async (id, actor) => {
  const target = await db('users').where({ id }).first();
  if (!target) throw notFound('User not found.');
  if (actor && actor.id === target.id) throw forbidden('You cannot delete your own account.');
  if (target.role === ROLES.ADMIN && (await activeAdminCount(target.id)) === 0) {
    throw conflict('The last active administrator cannot be deleted.');
  }
  const [{ c } = { c: 0 }] = await db('complaints').where({ citizen_id: id }).orWhere({ assigned_officer_id: id }).count({ c: '*' });
  if (Number(c) > 0) {
    throw conflict(
      `This user is linked to ${c} complaint(s). Deactivate the account instead to preserve the complaint history.`,
    );
  }
  await db('users').where({ id }).del();
  return { id };
};

/** Officers list for the assignment dialog, including current workload. */
export const listOfficers = async ({ wardId = null, includeInactive = false } = {}) => {
  const query = db('users as u').leftJoin('wards as w', 'w.id', 'u.ward_id').where('u.role', ROLES.OFFICER);
  if (!includeInactive) query.where('u.status', 'active');
  if (wardId) query.where('u.ward_id', wardId);
  const rows = await query.orderBy('u.name').select('u.*', 'w.name as ward_name', 'w.code as ward_code');

  const ids = rows.map((r) => r.id);
  const workload = ids.length
    ? await db('complaints')
        .whereIn('assigned_officer_id', ids)
        .whereIn('status', [STATUS.PENDING, STATUS.IN_PROGRESS])
        .groupBy('assigned_officer_id')
        .select('assigned_officer_id')
        .count({ total: 'id' })
    : [];
  const resolved = ids.length
    ? await db('complaints')
        .whereIn('assigned_officer_id', ids)
        .where('status', STATUS.RESOLVED)
        .groupBy('assigned_officer_id')
        .select('assigned_officer_id')
        .count({ total: 'id' })
    : [];
  const workloadMap = workload.reduce((a, r) => ({ ...a, [r.assigned_officer_id]: Number(r.total) }), {});
  const resolvedMap = resolved.reduce((a, r) => ({ ...a, [r.assigned_officer_id]: Number(r.total) }), {});

  return rows.map((row) => ({
    ...publicUser(row),
    activeAssignments: workloadMap[row.id] ?? 0,
    resolvedCount: resolvedMap[row.id] ?? 0,
  }));
};

/** Self-service profile update. */
export const updateProfile = async (user, payload) => {
  const target = await db('users').where({ id: user.id }).first();
  if (payload.email && payload.email !== target.email) {
    const clash = await db('users').where({ email: payload.email }).whereNot({ id: user.id }).first();
    if (clash) throw conflict('This email address is already used by another account.');
  }
  if (payload.mobile && payload.mobile !== target.mobile) {
    const clash = await db('users').where({ mobile: payload.mobile }).whereNot({ id: user.id }).first();
    if (clash) throw conflict('This mobile number is already used by another account.');
  }
  if (payload.rationNumber && payload.rationNumber !== target.ration_number) {
    const clash = await db('users').where({ ration_number: payload.rationNumber }).whereNot({ id: user.id }).first();
    if (clash) throw conflict('This ration number is already linked to another account.');
  }

  const patch = { updated_at: new Date() };
  ['name', 'email', 'mobile', 'address', 'wardId', 'rationNumber', 'preferredLanguage'].forEach((key) => {
    if (payload[key] !== undefined) {
      const column = { wardId: 'ward_id', rationNumber: 'ration_number', preferredLanguage: 'preferred_language' }[key] || key;
      patch[column] = payload[key];
    }
  });

  await db('users').where({ id: user.id }).update(patch);
  const row = await baseUserQuery().where('u.id', user.id).first();
  return selfUser(row, await db('notification_preferences').where({ user_id: user.id }).first());
};

export const updateAvatar = async (user, image) => {
  const row = await db('users').where({ id: user.id }).first();
  if (row.avatar_url && image) await removeUpload(row.avatar_url);
  await db('users').where({ id: user.id }).update({ avatar_url: image?.url ?? null, updated_at: new Date() });
  return updateProfile(user, {});
};

export const getPreferences = async (userId) => {
  const row = await db('notification_preferences').where({ user_id: userId }).first();
  if (!row) {
    await db('notification_preferences').insert({ user_id: userId }).onConflict('user_id').ignore();
    return db('notification_preferences').where({ user_id: userId }).first();
  }
  return row;
};

export const updatePreferences = async (userId, payload) => {
  await getPreferences(userId);
  const patch = { updated_at: new Date() };
  const map = {
    complaintNotifications: 'complaint_notifications',
    assignmentNotifications: 'assignment_notifications',
    resolutionNotifications: 'resolution_notifications',
    emailNotifications: 'email_notifications',
    smsNotifications: 'sms_notifications',
  };
  Object.entries(map).forEach(([key, column]) => {
    if (payload[key] !== undefined) patch[column] = Boolean(payload[key]);
  });
  await db('notification_preferences').where({ user_id: userId }).update(patch);
  return getPreferences(userId);
};

/** Aggregate counters used by the admin dashboard. */
export const countsByRole = async () => {
  const rows = await db('users').groupBy('role').select('role').count({ total: 'id' });
  const counts = { citizen: 0, officer: 0, admin: 0, total: 0, active: 0, inactive: 0 };
  rows.forEach((r) => {
    counts[r.role] = Number(r.total);
    counts.total += Number(r.total);
  });
  const statusRows = await db('users').groupBy('status').select('status').count({ total: 'id' });
  statusRows.forEach((r) => {
    if (r.status === 'active') counts.active = Number(r.total);
    else counts.inactive += Number(r.total);
  });
  return counts;
};

export default {
  list,
  getById,
  findById,
  create,
  update,
  setStatus,
  remove,
  listOfficers,
  updateProfile,
  updateAvatar,
  getPreferences,
  updatePreferences,
  countsByRole,
};
