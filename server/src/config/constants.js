/** Domain vocabulary shared by the API, the workflow engine and reporting. */

export const ROLES = Object.freeze({ CITIZEN: 'citizen', OFFICER: 'officer', ADMIN: 'admin' });
export const ROLE_VALUES = Object.freeze([ROLES.CITIZEN, ROLES.OFFICER, ROLES.ADMIN]);
export const ROLE_LABELS = Object.freeze({
  citizen: 'Citizen',
  officer: 'Village Officer',
  admin: 'Administrator',
});

export const STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
});
export const STATUS_VALUES = Object.freeze([
  STATUS.PENDING,
  STATUS.IN_PROGRESS,
  STATUS.RESOLVED,
  STATUS.REJECTED,
]);
export const STATUS_LABELS = Object.freeze({
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
});
/** Closed states never transition again (except by an explicit admin reopen). */
export const TERMINAL_STATUSES = Object.freeze([STATUS.RESOLVED, STATUS.REJECTED]);

export const PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});
export const PRIORITY_VALUES = Object.freeze(['low', 'medium', 'high', 'critical']);
export const PRIORITY_LABELS = Object.freeze({
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
});
/** Higher rank = more urgent; used for sorting / SLA emphasis. */
export const PRIORITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });

export const USER_STATUS = Object.freeze(['active', 'inactive', 'suspended']);

export const NOTIFICATION_TYPES = Object.freeze({
  COMPLAINT_REGISTERED: 'complaint_registered',
  COMPLAINT_ASSIGNED: 'complaint_assigned',
  STATUS_UPDATED: 'status_updated',
  COMPLAINT_RESOLVED: 'complaint_resolved',
  COMPLAINT_REJECTED: 'complaint_rejected',
  REMARK_ADDED: 'remark_added',
  COMPLAINT_APPROVED: 'complaint_approved',
  USER_WELCOME: 'user_welcome',
  ACCOUNT_UPDATED: 'account_updated',
});

/**
 * Allowed status transitions per role - the single source of truth for the
 * complaint lifecycle (§38 / §39 of the specification).
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [ROLES.ADMIN]: Object.freeze({
    pending: [STATUS.PENDING, STATUS.IN_PROGRESS, STATUS.REJECTED],
    in_progress: [STATUS.IN_PROGRESS, STATUS.RESOLVED, STATUS.REJECTED, STATUS.PENDING],
    resolved: [STATUS.RESOLVED, STATUS.IN_PROGRESS],
    rejected: [STATUS.REJECTED, STATUS.PENDING],
  }),
  [ROLES.OFFICER]: Object.freeze({
    pending: [STATUS.PENDING, STATUS.IN_PROGRESS],
    in_progress: [STATUS.IN_PROGRESS, STATUS.RESOLVED],
    resolved: [STATUS.RESOLVED],
    rejected: [STATUS.REJECTED],
  }),
  [ROLES.CITIZEN]: Object.freeze({
    pending: [STATUS.PENDING],
    in_progress: [STATUS.IN_PROGRESS],
    resolved: [STATUS.RESOLVED],
    rejected: [STATUS.REJECTED],
  }),
});

export const canTransition = (role, from, to) =>
  Boolean(ALLOWED_TRANSITIONS[role]?.[from]?.includes(to));

/** Human wording used in history entries, notifications and timelines. */
export const STATUS_EVENT_LABELS = Object.freeze({
  created: 'Complaint Registered',
  approved: 'Complaint Approved',
  assigned: 'Officer Assigned',
  reassigned: 'Officer Re-assigned',
  'status:in_progress': 'Investigation Started',
  'status:resolved': 'Issue Resolved',
  'status:rejected': 'Complaint Rejected',
  'status:pending': 'Moved Back To Pending',
  remark: 'Remark Added',
  updated: 'Complaint Updated',
});

export const DEFAULT_SETTINGS = Object.freeze([
  { key: 'portal.title', value: 'Village Complaint Management System', label: 'Portal title', group: 'general', type: 'string' },
  { key: 'portal.organisation', value: 'Government of Tamil Nadu', label: 'Organisation', group: 'general', type: 'string' },
  { key: 'portal.tagline', value: 'Digital Grievance Redressal Portal', label: 'Tagline', group: 'general', type: 'string' },
  { key: 'complaint.autoApprove', value: 'false', label: 'Auto-approve new complaints', group: 'workflow', type: 'boolean' },
  { key: 'complaint.slaDays', value: '7', label: 'Target resolution days (SLA)', group: 'workflow', type: 'number' },
  { key: 'complaint.allowImageUpload', value: 'true', label: 'Allow evidence image upload', group: 'workflow', type: 'boolean' },
  { key: 'notification.broadcastToOfficers', value: 'true', label: 'Notify officers on new complaints', group: 'notifications', type: 'boolean' },
  { key: 'security.sessionDays', value: '7', label: 'Session lifetime (days)', group: 'security', type: 'number' },
]);

export const CATEGORY_SEED = Object.freeze([
  { name: 'Water Supply Issues', slug: 'water-supply', icon: 'Droplets', colour: '#0284c7', description: 'Drinking water supply, pipeline leakage, low pressure or contaminated water.' },
  { name: 'Road Damage', slug: 'road-damage', icon: 'TrafficCone', colour: '#b45309', description: 'Potholes, damaged roads, missing pavements or culvert damage.' },
  { name: 'Street Light Problems', slug: 'street-light', icon: 'Lightbulb', colour: '#d97706', description: 'Non-functional, flickering or damaged street lights.' },
  { name: 'Garbage Collection', slug: 'garbage', icon: 'Trash2', colour: '#15803d', description: 'Missed collection, overflowing bins or illegal dumping.' },
  { name: 'Drainage Issues', slug: 'drainage', icon: 'Waves', colour: '#0e7490', description: 'Blocked storm water drains, overflow or stagnant water.' },
  { name: 'Public Health Issues', slug: 'public-health', icon: 'HeartPulse', colour: '#be123c', description: 'Mosquito breeding, health centre issues or disease outbreak risk.' },
  { name: 'Sanitation Issues', slug: 'sanitation', icon: 'SprayCan', colour: '#7c3aed', description: 'Public toilet upkeep, open defecation or cleaning of public spaces.' },
  { name: 'Other Complaints', slug: 'other', icon: 'CircleAlert', colour: '#475569', description: 'Grievances that do not fall under the categories above.' },
]);

export const WARD_SEED = Object.freeze([
  { name: 'Ward 1', code: 'W01', village: 'Kattupakkam', description: 'Bazaar Street, Temple Street, North Colony' },
  { name: 'Ward 2', code: 'W02', village: 'Kattupakkam', description: 'Anna Nagar, Kamaraj Street, East Colony' },
  { name: 'Ward 3', code: 'W03', village: 'Kattupakkam', description: 'Nehru Street, Mariamman Kovil Street' },
  { name: 'Ward 4', code: 'W04', village: 'Kattupakkam', description: 'Gandhi Street, School Road, South Colony' },
  { name: 'Ward 5', code: 'W05', village: 'Kattupakkam', description: 'Bharathi Street, Periyar Nagar, Bus Stand Road' },
  { name: 'Ward 6', code: 'W06', village: 'Kattupakkam', description: 'MGR Nagar, Lake View Street, West Colony' },
]);

export default {
  ROLES,
  ROLE_VALUES,
  STATUS,
  STATUS_VALUES,
  PRIORITY,
  PRIORITY_VALUES,
  NOTIFICATION_TYPES,
  canTransition,
};
