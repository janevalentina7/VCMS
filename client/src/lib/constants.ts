/** Presentation-level constants shared across the app. */
import {
  Droplets,
  TrafficCone,
  Lightbulb,
  Trash2,
  Waves,
  HeartPulse,
  SprayCan,
  CircleAlert,
  LayoutDashboard,
  FilePlus2,
  ClipboardList,
  Search,
  BarChart3,
  Users,
  Settings,
  Bell,
  UserCog,
  Tags,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { ComplaintStatus, Priority, Role } from '@/types';

export const STATUS_META: Record<ComplaintStatus, { label: string; className: string; dot: string; chart: string }> = {
  pending: {
    label: 'Pending',
    className: 'border-warning/35 bg-warning-soft text-warning',
    dot: 'bg-warning',
    chart: '#d97706',
  },
  in_progress: {
    label: 'In Progress',
    className: 'border-info/35 bg-info-soft text-info',
    dot: 'bg-info',
    chart: '#0284c7',
  },
  resolved: {
    label: 'Resolved',
    className: 'border-success/35 bg-success-soft text-success',
    dot: 'bg-success',
    chart: '#15803d',
  },
  rejected: {
    label: 'Rejected',
    className: 'border-danger/35 bg-danger-soft text-danger',
    dot: 'bg-danger',
    chart: '#b91c1c',
  },
};

export const PRIORITY_META: Record<Priority, { label: string; className: string; bar: string; dot: string }> = {
  low: { label: 'Low', className: 'border-line bg-elevated text-muted', bar: 'bg-success', dot: 'bg-success' },
  medium: { label: 'Medium', className: 'border-info/30 bg-info-soft text-info', bar: 'bg-info', dot: 'bg-info' },
  high: { label: 'High', className: 'border-warning/35 bg-warning-soft text-warning', bar: 'bg-warning', dot: 'bg-warning' },
  critical: { label: 'Critical', className: 'border-danger/40 bg-danger-soft text-danger', bar: 'bg-danger', dot: 'bg-danger' },
};

export const ROLE_META: Record<Role, { label: string; className: string; description: string }> = {
  citizen: { label: 'Citizen', className: 'border-info/35 bg-info-soft text-info', description: 'Registers and tracks grievances' },
  officer: { label: 'Village Officer', className: 'border-primary/40 bg-primary-soft text-primary', description: 'Resolves assigned complaints' },
  admin: { label: 'Administrator', className: 'border-accent/35 bg-danger-soft text-accent', description: 'Full portal administration' },
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Droplets,
  TrafficCone,
  Lightbulb,
  Trash2,
  Waves,
  HeartPulse,
  SprayCan,
  CircleAlert,
  Tags,
};

export const categoryIcon = (name?: string | null): LucideIcon => (name && CATEGORY_ICONS[name]) || CircleAlert;

export const CATEGORY_FALLBACK: { name: string; slug: string; icon: string; colour: string }[] = [
  { name: 'Water Supply Issues', slug: 'water-supply', icon: 'Droplets', colour: '#0284c7' },
  { name: 'Road Damage', slug: 'road-damage', icon: 'TrafficCone', colour: '#b45309' },
  { name: 'Street Light Problems', slug: 'street-light', icon: 'Lightbulb', colour: '#d97706' },
  { name: 'Garbage Collection', slug: 'garbage', icon: 'Trash2', colour: '#15803d' },
  { name: 'Drainage Issues', slug: 'drainage', icon: 'Waves', colour: '#0e7490' },
  { name: 'Public Health Issues', slug: 'public-health', icon: 'HeartPulse', colour: '#be123c' },
  { name: 'Sanitation Issues', slug: 'sanitation', icon: 'SprayCan', colour: '#7c3aed' },
  { name: 'Other Complaints', slug: 'other', icon: 'CircleAlert', colour: '#475569' },
];

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  end?: boolean;
  badge?: 'notifications';
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['citizen', 'officer', 'admin'], end: true },
  { label: 'Register Complaint', to: '/complaints/new', icon: FilePlus2, roles: ['citizen', 'admin'] },
  { label: 'View Complaints', to: '/complaints', icon: ClipboardList, roles: ['citizen', 'officer', 'admin'] },
  { label: 'Track Status', to: '/track', icon: Search, roles: ['citizen', 'officer', 'admin'] },
  { label: 'Reports & Analytics', to: '/reports', icon: BarChart3, roles: ['admin', 'officer', 'citizen'] },
  { label: 'Users', to: '/users', icon: Users, roles: ['admin'] },
  { label: 'Officers', to: '/officers', icon: UserCog, roles: ['admin'] },
  { label: 'Wards', to: '/wards', icon: MapPin, roles: ['admin'] },
  { label: 'Categories', to: '/categories', icon: Tags, roles: ['admin'] },
  { label: 'Notifications', to: '/notifications', icon: Bell, roles: ['citizen', 'officer', 'admin'], badge: 'notifications' },
  { label: 'Settings', to: '/settings', icon: Settings, roles: ['citizen', 'officer', 'admin'] },
];

export const STATUS_OPTIONS: { value: ComplaintStatus | 'all' | 'open'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'open', label: 'Open (pending + in progress)' },
];

export const PRIORITY_OPTIONS: { value: Priority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Priority (high to low)' },
  { value: 'status', label: 'Status' },
] as const;

export const TIMELINE_STEPS = ['Complaint Registered', 'Complaint Approved', 'Officer Assigned', 'Investigation Started', 'Issue Resolved'];

export const ACTION_LABELS: Record<string, string> = {
  created: 'Complaint Registered',
  approved: 'Complaint Approved',
  assigned: 'Officer Assigned',
  reassigned: 'Officer Re-assigned',
  'status:in_progress': 'Investigation Started',
  'status:resolved': 'Issue Resolved',
  'status:rejected': 'Complaint Rejected',
  'status:pending': 'Moved To Pending',
  remark: 'Remark Added',
  updated: 'Complaint Updated',
};

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

export const MAX_UPLOAD_MB = 5;
