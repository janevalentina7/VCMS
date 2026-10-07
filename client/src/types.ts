/** Shared API types - mirrors the DTOs produced by server/src/utils/serializers.js */

export type Role = 'citizen' | 'officer' | 'admin';
export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  roleLabel: string;
  rationNumber: string | null;
  wardId: number | null;
  wardName: string | null;
  wardCode: string | null;
  address: string | null;
  designation: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  preferredLanguage: string;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  complaintCount?: number;
  activeAssignments?: number;
  resolvedCount?: number;
}

export interface NotificationPreferences {
  complaintNotifications: boolean;
  assignmentNotifications: boolean;
  resolutionNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export interface SessionUser extends User {
  preferences: NotificationPreferences;
}

export interface Branding {
  appName: string;
  organisation: string;
  tagline: string;
  complaintPrefix: string;
  maxUploadMb: number;
}

export interface AuthResponse {
  user: SessionUser;
  accessToken: string;
  expiresAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  colour: string;
  active: boolean;
  sortOrder: number;
  complaintCount?: number;
  createdAt: string | null;
}

export interface Ward {
  id: number;
  name: string;
  code: string;
  village: string | null;
  description: string | null;
  active: boolean;
  officerCount?: number;
  complaintCount?: number;
}

export interface ComplaintHistoryEntry {
  id: number;
  oldStatus: ComplaintStatus | null;
  newStatus: ComplaintStatus | null;
  action: string;
  remarks: string | null;
  changedBy: number | null;
  changedByName: string | null;
  changedByRole: string | null;
  timestamp: string;
}

export interface Assignment {
  id: number;
  complaintId: number;
  officerId: number;
  officerName: string | null;
  assignedBy: number | null;
  assignedByName: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  notes: string | null;
  active: boolean;
}

export interface ComplaintSummary {
  id: number;
  complaintId: string;
  citizenId: number;
  citizenName: string;
  rationNumber: string | null;
  mobileNumber: string;
  categoryId: number;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColour: string | null;
  description: string;
  streetName: string;
  area: string | null;
  location: string;
  wardId: number | null;
  wardName: string | null;
  wardCode: string | null;
  priority: Priority;
  priorityLabel: string;
  status: ComplaintStatus;
  statusLabel: string;
  assignedOfficerId: number | null;
  assignedOfficerName: string | null;
  complaintDate: string;
  resolutionDate: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ComplaintDetail extends ComplaintSummary {
  latitude: number | null;
  longitude: number | null;
  remarks: string | null;
  resolutionRemarks: string | null;
  rejectionReason: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  resolvedBy: number | null;
  citizen: {
    id: number;
    name: string;
    rationNumber: string | null;
    mobile: string;
    email: string | null;
    wardName: string | null;
    address: string | null;
  };
  assignment: {
    officerId: number;
    officerName: string | null;
    officerMobile: string | null;
    officerEmail: string | null;
    assignedAt: string | null;
    assignedBy: number | null;
    assignedByName: string | null;
  } | null;
  history: ComplaintHistoryEntry[];
  assignments: Assignment[];
}

export interface AppNotification {
  id: number;
  userId: number;
  complaintId: number | null;
  complaintRef: string | null;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: { pagination: Pagination };
}

export interface ComplaintFilters {
  q?: string;
  status?: string;
  priority?: string;
  categoryId?: string | number;
  wardId?: string | number;
  officerId?: string | number;
  from?: string;
  to?: string;
  sort?: 'newest' | 'oldest' | 'priority' | 'status';
  page?: number;
  pageSize?: number;
}

export interface Kpis {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  rejected: number;
  priority: Record<Priority, number>;
  resolutionRate: number;
  pendingRate: number;
  rejectionRate: number;
  inProgressRate: number;
  averageResolutionDays: number;
  resolvedCount: number;
  thisMonth: number;
  lastMonth: number;
  monthlyGrowth: number;
  mostCommonCategory?: { name: string; count: number; percentage: number } | null;
  highestComplaintWard?: { name: string; code: string; count: number } | null;
}

export interface AnalyticsDashboard {
  kpis: Kpis;
  charts: {
    categories: { categoryId: number; category: string; colour: string; count: number; percentage: number }[];
    statuses: { status: ComplaintStatus; label: string; count: number; colour: string; percentage: number }[];
    wards: { wardId: number | null; ward: string; code: string; count: number; resolved: number }[];
    priorities: { priority: Priority; label: string; count: number; colour: string }[];
    monthly: { year: number; years: number[]; series: MonthlyPoint[] };
  };
}

export interface MonthlyPoint {
  month: number;
  label: string;
  year: number;
  total: number;
  resolved: number;
  rejected: number;
  pending: number;
  inProgress: number;
}

export interface ReportPayload {
  meta: {
    organisation: string;
    title: string;
    subtitle: string;
    generatedAt: string;
    generatedBy: string;
    generatedByRole: string;
    disclaimer: string;
  };
  filters: Record<string, string | null>;
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    rejected: number;
    resolutionRate: number;
    pendingRate: number;
    rejectionRate: number;
    averageResolutionDays: number;
    byPriority: Record<Priority, number>;
    byCategory: { name: string; count: number; percentage: number }[];
    byWard: { name: string; count: number; percentage: number }[];
    byOfficer: { name: string; count: number }[];
    statusBreakdown: { status: ComplaintStatus; label: string; count: number; percentage: number }[];
  };
  complaints: {
    id: number;
    complaintId: string;
    citizenName: string;
    rationNumber: string | null;
    mobileNumber: string;
    category: string;
    ward: string | null;
    location: string;
    street: string;
    priority: Priority;
    status: ComplaintStatus;
    statusLabel: string;
    officer: string | null;
    complaintDate: string;
    resolutionDate: string | null;
    description: string;
  }[];
  reference: {
    categories: { id: number; name: string }[];
    wards: { id: number; name: string; code: string }[];
    officers: { id: number; name: string }[];
  };
}

export interface PublicStats {
  totalComplaints: number;
  resolved: number;
  inProgress: number;
  pending: number;
  rejected: number;
  resolutionRate: number;
  citizens: number;
  categories: number;
}

export interface OfficerSummary {
  assigned: number;
  pending: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  highPriority: number;
  overdue: number;
  resolutionRate: number;
  averageResolutionDays: number;
  thisMonth: number;
  monthlyGrowth: number;
}

export interface Setting {
  key: string;
  value: string | null;
  label: string;
  group: string;
  type: string;
  updatedAt?: string | null;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: { field: string; message: string }[];
  path?: string;
}

export interface FieldErrors {
  [field: string]: string;
}
