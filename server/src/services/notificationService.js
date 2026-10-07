/**
 * Notification service.
 *
 * All complaint lifecycle events funnel through here so that in-app
 * notifications stay consistent, and so that future channels (email / SMS /
 * push) can be attached in one place. Delivery to those channels is already
 * routed through `dispatchExternal` which is a no-op until credentials are
 * configured.
 */
import { db } from '../db/index.js';
import config from '../config/env.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import { notification as serialize } from '../utils/serializers.js';
import { logger } from '../utils/logger.js';

/** Placeholder for email/SMS fan-out (future integration point). */
const dispatchExternal = async (channels, payload) => {
  const enabled = config.integrations.smtpUrl || config.integrations.smsApiKey;
  if (!enabled) return;
  logger.debug('external notification dispatch requested', { channels, payload: payload.type });
  // Intentionally unimplemented: wire the provider SDK here.
};

export const createNotification = async (trx, payload) => {
  const conn = trx || db;
  const [row] = await conn('notifications')
    .insert({
      user_id: payload.userId,
      complaint_id: payload.complaintDbId ?? null,
      complaint_ref: payload.complaintRef ?? null,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      severity: payload.severity ?? 'info',
      link: payload.link ?? null,
      is_read: false,
      created_at: new Date(),
    })
    .returning(['id']);

  // `returning` shape differs between dialects (sqlite returns primitives,
  // postgres returns objects) - normalise both.
  const id = Array.isArray(row) ? (row[0] && typeof row[0] === 'object' ? row[0].id : row[0]) : row?.id ?? row;

  // Respect per-user preferences for the optional channels.
  if (payload.channels) await dispatchExternal(payload.channels, payload);
  return id;
};

/** Bulk insert helper (used for broadcasting to every administrator). */
export const createMany = async (trx, payloads) => {
  if (!payloads.length) return 0;
  const conn = trx || db;
  await conn('notifications').insert(
    payloads.map((p) => ({
      user_id: p.userId,
      complaint_id: p.complaintDbId ?? null,
      complaint_ref: p.complaintRef ?? null,
      type: p.type,
      title: p.title,
      message: p.message,
      severity: p.severity ?? 'info',
      link: p.link ?? null,
      is_read: false,
      created_at: new Date(),
    })),
  );
  return payloads.length;
};

export const userIdsByRole = async (role, conn = db) => {
  const rows = await conn('users').where({ role, status: 'active' }).select('id');
  return rows.map((r) => r.id);
};

// ── Domain specific helpers ─────────────────────────────────────────────────

export const notifyComplaintRegistered = async (trx, complaint, { admins }) => {
  const link = `/complaints/${complaint.id}`;
  const payloads = admins.map((adminId) => ({
    userId: adminId,
    complaintDbId: complaint.id,
    complaintRef: complaint.complaint_id,
    type: NOTIFICATION_TYPES.COMPLAINT_REGISTERED,
    title: 'New complaint registered',
    message: `New complaint ${complaint.complaint_id} has been registered and is awaiting review.`,
    severity: 'info',
    link,
  }));
  await createMany(trx, payloads);

  await createNotification(trx, {
    userId: complaint.citizen_id,
    complaintDbId: complaint.id,
    complaintRef: complaint.complaint_id,
    type: NOTIFICATION_TYPES.COMPLAINT_REGISTERED,
    title: 'Complaint registered successfully',
    message: `Your complaint ${complaint.complaint_id} has been registered and is currently Pending. You can track it any time using this reference number.`,
    severity: 'success',
    link: `/track?complaintId=${complaint.complaint_id}`,
    channels: ['email', 'sms'],
  });
};

export const notifyComplaintApproved = async (trx, complaint, adminName) => {
  await createNotification(trx, {
    userId: complaint.citizen_id,
    complaintDbId: complaint.id,
    complaintRef: complaint.complaint_id,
    type: NOTIFICATION_TYPES.COMPLAINT_APPROVED,
    title: 'Complaint approved',
    message: `Complaint ${complaint.complaint_id} has been reviewed and approved${adminName ? ` by ${adminName}` : ''}. It will now be assigned to a village officer.`,
    severity: 'success',
    link: `/complaints/${complaint.id}`,
  });
};

export const notifyComplaintAssigned = async (trx, complaint, officer) => {
  await createNotification(trx, {
    userId: officer.id,
    complaintDbId: complaint.id,
    complaintRef: complaint.complaint_id,
    type: NOTIFICATION_TYPES.COMPLAINT_ASSIGNED,
    title: 'New complaint assigned to you',
    message: `Complaint ${complaint.complaint_id} (${complaint.priority} priority) has been assigned to you. Location: ${complaint.location}.`,
    severity: complaint.priority === 'critical' || complaint.priority === 'high' ? 'warning' : 'info',
    link: `/complaints/${complaint.id}`,
    channels: ['email', 'sms'],
  });

  await createNotification(trx, {
    userId: complaint.citizen_id,
    complaintDbId: complaint.id,
    complaintRef: complaint.complaint_id,
    type: NOTIFICATION_TYPES.COMPLAINT_ASSIGNED,
    title: 'Officer assigned to your complaint',
    message: `Complaint ${complaint.complaint_id} has been assigned to Officer ${officer.name}.`,
    severity: 'info',
    link: `/track?complaintId=${complaint.complaint_id}`,
  });
};

export const notifyStatusUpdated = async (trx, complaint, newStatus, label, actor) => {
  const isResolved = newStatus === 'resolved';
  const isRejected = newStatus === 'rejected';
  await createNotification(trx, {
    userId: complaint.citizen_id,
    complaintDbId: complaint.id,
    complaintRef: complaint.complaint_id,
    type: isResolved
      ? NOTIFICATION_TYPES.COMPLAINT_RESOLVED
      : isRejected
        ? NOTIFICATION_TYPES.COMPLAINT_REJECTED
        : NOTIFICATION_TYPES.STATUS_UPDATED,
    title: isResolved ? 'Complaint resolved' : isRejected ? 'Complaint rejected' : 'Complaint status updated',
    message: isResolved
      ? `Complaint ${complaint.complaint_id} has been resolved. Please review the resolution details.`
      : isRejected
        ? `Complaint ${complaint.complaint_id} has been rejected. Open the complaint to read the reason provided.`
        : `Complaint ${complaint.complaint_id} status changed to ${label}${actor ? ` by ${actor}` : ''}.`,
    severity: isResolved ? 'success' : isRejected ? 'error' : 'info',
    link: `/track?complaintId=${complaint.complaint_id}`,
    channels: isResolved || isRejected ? ['email', 'sms'] : [],
  });
};

export const notifyRemarkAdded = async (trx, complaint, actor, remarks) => {
  await createNotification(trx, {
    userId: complaint.citizen_id,
    complaintDbId: complaint.id,
    complaintRef: complaint.complaint_id,
    type: NOTIFICATION_TYPES.REMARK_ADDED,
    title: 'New remark on your complaint',
    message: `${actor} added a remark on complaint ${complaint.complaint_id}: "${String(remarks).slice(0, 120)}${String(remarks).length > 120 ? '…' : ''}"`,
    severity: 'info',
    link: `/track?complaintId=${complaint.complaint_id}`,
  });
};

export const notifyUserWelcome = async (trx, user) => {
  await createNotification(trx, {
    userId: user.id,
    type: NOTIFICATION_TYPES.USER_WELCOME,
    title: 'Welcome to the grievance portal',
    message: `Your citizen account is ready. You can now register and track village complaints online.`,
    severity: 'success',
    link: '/complaints/new',
  });
};

// ── Queries ────────────────────────────────────────────────────────────────

export const listNotifications = async (userId, { unreadOnly = false, page = 1, pageSize = 20 } = {}) => {
  const base = db('notifications').where('user_id', userId);
  if (unreadOnly) base.andWhere('is_read', false);
  const [{ total } = { total: 0 }] = await base.clone().count({ total: '*' });
  const rows = await base
    .clone()
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ unread } = { unread: 0 }] = await db('notifications')
    .where({ user_id: userId, is_read: false })
    .count({ unread: '*' });
  return {
    items: rows.map(serialize),
    total: Number(total),
    unreadCount: Number(unread),
    page,
    pageSize,
  };
};

export const unreadCount = async (userId) => {
  const [row] = await db('notifications').where({ user_id: userId, is_read: false }).count({ c: '*' });
  return Number(row?.c ?? 0);
};

export const markRead = async (userId, id, read = true) => {
  const exists = await db('notifications').where({ id, user_id: userId }).first('id');
  if (!exists) return null;
  await db('notifications')
    .where({ id, user_id: userId })
    .update({ is_read: read, read_at: read ? new Date() : null });
  const row = await db('notifications').where({ id }).first();
  return serialize(row);
};

export const markAllRead = async (userId) => {
  const count = await db('notifications')
    .where({ user_id: userId, is_read: false })
    .update({ is_read: true, read_at: new Date() });
  return Number(count || 0);
};

export const clearRead = async (userId) => {
  const count = await db('notifications').where({ user_id: userId, is_read: true }).del();
  return Number(count || 0);
};

export default {
  createNotification,
  createMany,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  notifyComplaintRegistered,
  notifyComplaintApproved,
  notifyComplaintAssigned,
  notifyStatusUpdated,
  notifyRemarkAdded,
  notifyUserWelcome,
};
