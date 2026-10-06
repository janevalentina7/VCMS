/**
 * Row -> API DTO mapping. Guarantees sensitive columns (password_hash,
 * refresh token hashes, internal ids where not required) never reach a client.
 */
import { asIso } from '../db/index.js';
import { ROLE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '../config/constants.js';

const text = (v) => (v === undefined ? undefined : v);

export const publicUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role] || row.role,
    rationNumber: text(row.ration_number) ?? null,
    wardId: row.ward_id ?? null,
    wardName: row.ward_name ?? null,
    wardCode: row.ward_code ?? null,
    address: text(row.address) ?? null,
    designation: text(row.designation) ?? null,
    avatarUrl: text(row.avatar_url) ?? null,
    status: row.status,
    preferredLanguage: row.preferred_language ?? 'en',
    lastLoginAt: asIso(row.last_login_at),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
};

/** Self view adds private-but-owned fields (preferences). */
export const selfUser = (row, preferences = null) => ({
  ...publicUser(row),
  preferences: preferences
    ? {
        complaintNotifications: Boolean(preferences.complaint_notifications),
        assignmentNotifications: Boolean(preferences.assignment_notifications),
        resolutionNotifications: Boolean(preferences.resolution_notifications),
        emailNotifications: Boolean(preferences.email_notifications),
        smsNotifications: Boolean(preferences.sms_notifications),
      }
    : {
        complaintNotifications: true,
        assignmentNotifications: true,
        resolutionNotifications: true,
        emailNotifications: false,
        smsNotifications: false,
      },
});

export const category = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? null,
  icon: row.icon ?? 'CircleAlert',
  colour: row.colour ?? '#1d4ed8',
  active: Boolean(row.active),
  sortOrder: row.sort_order ?? 0,
  complaintCount: row.complaint_count !== undefined ? Number(row.complaint_count) : undefined,
  createdAt: asIso(row.created_at),
  updatedAt: asIso(row.updated_at),
});

export const ward = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  village: row.village ?? null,
  description: row.description ?? null,
  active: Boolean(row.active),
  officerCount: row.officer_count !== undefined ? Number(row.officer_count) : undefined,
  complaintCount: row.complaint_count !== undefined ? Number(row.complaint_count) : undefined,
  createdAt: asIso(row.created_at),
});

export const complaintSummary = (row) => ({
  id: row.id,
  complaintId: row.complaint_id,
  citizenId: row.citizen_id,
  citizenName: row.citizen_name,
  rationNumber: row.ration_number ?? null,
  mobileNumber: row.mobile_number,
  categoryId: row.category_id,
  categoryName: row.category_name ?? null,
  categoryIcon: row.category_icon ?? null,
  categoryColour: row.category_colour ?? null,
  description: row.description,
  streetName: row.street_name,
  area: row.area ?? null,
  location: row.location,
  wardId: row.ward_id ?? null,
  wardName: row.ward_name ?? null,
  wardCode: row.ward_code ?? null,
  priority: row.priority,
  priorityLabel: PRIORITY_LABELS[row.priority] || row.priority,
  status: row.status,
  statusLabel: STATUS_LABELS[row.status] || row.status,
  assignedOfficerId: row.assigned_officer_id ?? null,
  assignedOfficerName: row.officer_name ?? null,
  complaintDate: asIso(row.complaint_date),
  resolutionDate: asIso(row.resolution_date),
  imageUrl: row.image_url ?? null,
  createdAt: asIso(row.created_at),
  updatedAt: asIso(row.updated_at),
});

export const complaintDetail = (row, extra = {}) => ({
  ...complaintSummary(row),
  latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
  longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
  remarks: row.remarks ?? null,
  resolutionRemarks: row.resolution_remarks ?? null,
  rejectionReason: row.rejection_reason ?? null,
  approvedBy: row.approved_by ?? null,
  approvedAt: asIso(row.approved_at),
  resolvedBy: row.resolved_by ?? null,
  citizen: {
    id: row.citizen_id,
    name: row.citizen_name,
    rationNumber: row.ration_number ?? null,
    mobile: row.mobile_number,
    email: row.citizen_email ?? null,
    wardName: row.ward_name ?? null,
    address: row.citizen_address ?? null,
  },
  assignment: row.assigned_officer_id
    ? {
        officerId: row.assigned_officer_id,
        officerName: row.officer_name ?? null,
        officerMobile: row.officer_mobile ?? null,
        officerEmail: row.officer_email ?? null,
        assignedAt: asIso(row.assigned_at),
        assignedBy: row.assigned_by ?? null,
        assignedByName: row.assigned_by_name ?? null,
      }
    : null,
  history: extra.history ?? [],
  assignments: extra.assignments ?? [],
});

export const history = (row) => ({
  id: row.id,
  complaintId: row.complaint_db_id ?? row.complaint_id,
  complaintRef: row.complaint_ref ?? null,
  oldStatus: row.old_status ?? null,
  newStatus: row.new_status ?? null,
  action: row.action,
  remarks: row.remarks ?? null,
  changedBy: row.changed_by ?? null,
  changedByName: row.changed_by_name ?? null,
  changedByRole: row.changed_by_role ?? null,
  timestamp: asIso(row.timestamp),
});

export const notification = (row) => ({
  id: row.id,
  userId: row.user_id,
  complaintId: row.complaint_id ?? null,
  complaintRef: row.complaint_ref ?? null,
  type: row.type,
  title: row.title,
  message: row.message,
  severity: row.severity ?? 'info',
  link: row.link ?? null,
  isRead: Boolean(row.is_read),
  readAt: asIso(row.read_at),
  createdAt: asIso(row.created_at),
});

export const assignment = (row) => ({
  id: row.id,
  complaintId: row.complaint_id,
  complaintRef: row.complaint_ref ?? null,
  officerId: row.officer_id,
  officerName: row.officer_name ?? null,
  assignedBy: row.assigned_by ?? null,
  assignedByName: row.assigned_by_name ?? null,
  assignedAt: asIso(row.assigned_at),
  unassignedAt: asIso(row.unassigned_at),
  notes: row.notes ?? null,
  active: Boolean(row.active),
});

export const session = (row) => ({
  id: row.id,
  userAgent: row.user_agent ?? null,
  ipAddress: row.ip_address ?? null,
  current: Boolean(row.current),
  createdAt: asIso(row.created_at),
  lastSeenAt: asIso(row.last_seen_at),
  expiresAt: asIso(row.expires_at),
});

export default {
  publicUser,
  selfUser,
  category,
  ward,
  complaintSummary,
  complaintDetail,
  history,
  notification,
  assignment,
  session,
};
