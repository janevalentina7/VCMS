/**
 * Zod request schemas - the API-level counterpart of the client-side form
 * validation. Field level messages here are user facing (they surface in
 * toasts / inline errors), so they stay friendly and specific.
 */
import { z } from 'zod';
import { ROLE_VALUES, STATUS_VALUES, PRIORITY_VALUES, USER_STATUS } from '../config/constants.js';

const trimmed = (min, max, label) =>
  z
    .string({ required_error: `${label} is required.` })
    .transform((v) => v.trim())
    .refine((v) => v.length >= min, { message: `${label} must be at least ${min} characters.` })
    .refine((v) => v.length <= max, { message: `${label} must not exceed ${max} characters.` });

export const NAME_PATTERN = /^[A-Za-z\u0B80-\u0BFF][A-Za-z\u0B80-\u0BFF.\s'-]*$/;
export const RATION_PATTERN = /^[A-Z]{2}[0-9]{8,12}$/;
export const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const nameField = (label = 'Name') =>
  z
    .string({ required_error: `${label} is required.` })
    .transform((v) => v.trim().replace(/\s+/g, ' '))
    .refine((v) => v.length >= 2, { message: `${label} must be at least 2 characters.` })
    .refine((v) => v.length <= 120, { message: `${label} must not exceed 120 characters.` })
    .refine((v) => NAME_PATTERN.test(v), {
      message: `${label} may contain alphabetic characters and spaces only.`,
    });

export const mobileField = (label = 'Mobile number') =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(/[\s-]/g, '').replace(/^(\+91|91)(?=[6-9]\d{9}$)/, ''))
    .refine((v) => MOBILE_PATTERN.test(v), {
      message: `${label} must be a valid 10 digit Indian mobile number starting with 6-9.`,
    });

export const rationField = (label = 'Ration number') =>
  z
    .string({ required_error: `${label} is required.` })
    .transform((v) => v.trim().toUpperCase().replace(/[\s-]/g, ''))
    .refine((v) => RATION_PATTERN.test(v), {
      message: `${label} must be in the format TN123456789 (2 letters followed by 8-12 digits).`,
    });

export const optionalRationField = (label = 'Ration number') =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim().toUpperCase().replace(/[\s-]/g, '')))
    .refine((v) => v === null || RATION_PATTERN.test(v), {
      message: `${label} must be in the format TN123456789 (2 letters followed by 8-12 digits).`,
    });

const optionalId = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '' || v === 'all') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

// ── Auth ────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: nameField('Full name'),
  email: z
    .string({ required_error: 'Email address is required.' })
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => z.string().email().safeParse(v).success, { message: 'Enter a valid email address.' }),
  mobile: mobileField('Mobile number'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, { message: 'Password must be at least 8 characters long.' })
    .max(72, { message: 'Password must not exceed 72 characters.' })
    .refine((v) => PASSWORD_PATTERN.test(v), {
      message: 'Password must contain at least one letter and one number.',
    }),
  confirmPassword: z.string().optional(),
  rationNumber: optionalRationField(),
  wardId: optionalId,
  address: z.string().trim().max(255).optional().nullable(),
  role: z.enum(ROLE_VALUES).optional(),
})
  .refine((d) => !d.confirmPassword || d.confirmPassword === d.password, {
    message: 'Password and confirmation password do not match.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  identifier: z.string({ required_error: 'Email, mobile number or ration number is required.' }).transform((v) => v.trim()),
  password: z.string({ required_error: 'Password is required.' }).min(1, { message: 'Password is required.' }),
  remember: z.boolean().optional().default(false),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Current password is required.' }).min(1, { message: 'Current password is required.' }),
    newPassword: z
      .string({ required_error: 'New password is required.' })
      .min(8, { message: 'New password must be at least 8 characters long.' })
      .max(72, { message: 'New password must not exceed 72 characters.' })
      .refine((v) => PASSWORD_PATTERN.test(v), {
        message: 'New password must contain at least one letter and one number.',
      }),
    confirmPassword: z.string().optional(),
  })
  .refine((d) => !d.confirmPassword || d.confirmPassword === d.newPassword, {
    message: 'New password and confirmation do not match.',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'The new password must be different from the current password.',
    path: ['newPassword'],
  });

// ── Complaints ──────────────────────────────────────────────────────────────
export const complaintCreateSchema = z.object({
  citizenName: nameField('Citizen name'),
  rationNumber: rationField(),
  mobileNumber: mobileField('Mobile number'),
  categoryId: optionalId,
  categorySlug: z.string().trim().optional().nullable(),
  description: trimmed(30, 2000, 'Complaint description'),
  streetName: trimmed(3, 160, 'Street name'),
  area: z.string().trim().max(160).optional().nullable(),
  location: trimmed(3, 255, 'Location'),
  wardId: optionalId,
  priority: z.enum(PRIORITY_VALUES, {
    errorMap: () => ({ message: 'Select a priority level (Low, Medium, High or Critical).' }),
  }),
  latitude: z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
  }),
  longitude: z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
  }),
  complaintDate: z.union([z.string(), z.date()]).optional().nullable().transform((v) => (v ? new Date(v) : null)),
})
  .refine((d) => Boolean(d.categoryId || d.categorySlug), {
    message: 'Complaint category is required.',
    path: ['categoryId'],
  })
  .refine((d) => !d.complaintDate || !Number.isNaN(d.complaintDate.getTime()), {
    message: 'Enter a valid complaint date.',
    path: ['complaintDate'],
  })
  .refine((d) => !d.complaintDate || d.complaintDate.getTime() <= Date.now() + 60_000, {
    message: 'Complaint date cannot be in the future.',
    path: ['complaintDate'],
  });

export const complaintUpdateSchema = z.object({
  categoryId: optionalId,
  description: z.string().trim().min(30, { message: 'Complaint description must be at least 30 characters.' }).max(2000).optional(),
  streetName: z.string().trim().min(3).max(160).optional(),
  area: z.string().trim().max(160).optional().nullable(),
  location: z.string().trim().min(3).max(255).optional(),
  wardId: optionalId,
  priority: z.enum(PRIORITY_VALUES).optional(),
  mobileNumber: mobileField('Mobile number').optional(),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export const statusUpdateSchema = z
  .object({
    status: z.enum(STATUS_VALUES, {
      errorMap: () => ({ message: 'Status must be Pending, In Progress, Resolved or Rejected.' }),
    }),
    remarks: z.string().trim().max(2000).optional().nullable(),
    resolutionRemarks: z.string().trim().max(2000).optional().nullable(),
    rejectionReason: z.string().trim().max(500, { message: 'Rejection reason must not exceed 500 characters.' }).optional().nullable(),
  })
  .refine((d) => d.status !== 'rejected' || (d.rejectionReason ?? d.remarks)?.length >= 10, {
    message: 'A rejection reason of at least 10 characters is required when rejecting a complaint.',
    path: ['rejectionReason'],
  })
  .refine((d) => d.status !== 'resolved' || (d.resolutionRemarks ?? d.remarks)?.length >= 10, {
    message: 'Please describe the resolution (at least 10 characters) before marking the complaint resolved.',
    path: ['resolutionRemarks'],
  });

export const remarkSchema = z.object({
  remarks: trimmed(3, 2000, 'Remark'),
  status: z.enum(STATUS_VALUES).optional(),
});

export const assignSchema = z.object({
  officerId: z.coerce.number({ required_error: 'Select an officer to assign this complaint.' })
    .int({ message: 'Select a valid officer.' })
    .positive({ message: 'Select a valid officer.' }),
  notes: z.string().trim().max(255).optional().nullable(),
});

export const complaintQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum([...STATUS_VALUES, 'all', 'open']).optional(),
  priority: z.enum([...PRIORITY_VALUES, 'all']).optional(),
  categoryId: optionalId,
  wardId: optionalId,
  officerId: optionalId,
  citizenId: optionalId,
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest', 'priority', 'status']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
  mine: z.enum(['true', 'false']).optional(),
});

// ── Users ───────────────────────────────────────────────────────────────────
export const userCreateSchema = z.object({
  name: nameField('Full name'),
  email: z
    .string({ required_error: 'Email address is required.' })
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => z.string().email().safeParse(v).success, { message: 'Enter a valid email address.' }),
  mobile: mobileField('Mobile number'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, { message: 'Password must be at least 8 characters long.' })
    .refine((v) => PASSWORD_PATTERN.test(v), { message: 'Password must contain at least one letter and one number.' }),
  role: z.enum(ROLE_VALUES, { errorMap: () => ({ message: 'Role must be Citizen, Village Officer or Administrator.' }) }),
  wardId: optionalId,
  rationNumber: optionalRationField(),
  address: z.string().trim().max(255).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  status: z.enum(USER_STATUS).optional(),
});

export const userUpdateSchema = z.object({
  name: nameField('Full name').optional(),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => z.string().email().safeParse(v).success, { message: 'Enter a valid email address.' })
    .optional(),
  mobile: mobileField('Mobile number').optional(),
  role: z.enum(ROLE_VALUES).optional(),
  wardId: optionalId,
  rationNumber: optionalRationField(),
  address: z.string().trim().max(255).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  status: z.enum(USER_STATUS).optional(),
});

export const profileUpdateSchema = z.object({
  name: nameField('Full name').optional(),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => z.string().email().safeParse(v).success, { message: 'Enter a valid email address.' })
    .optional(),
  mobile: mobileField('Mobile number').optional(),
  address: z.string().trim().max(255).optional().nullable(),
  wardId: optionalId,
  rationNumber: optionalRationField(),
  preferredLanguage: z.enum(['en', 'ta']).optional(),
});

export const notificationPreferencesSchema = z.object({
  complaintNotifications: z.boolean().optional(),
  assignmentNotifications: z.boolean().optional(),
  resolutionNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
});

export const userQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum([...ROLE_VALUES, 'all']).optional(),
  status: z.enum([...USER_STATUS, 'all']).optional(),
  wardId: optionalId,
  sort: z.enum(['newest', 'oldest', 'name']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
});

// ── Categories & wards ──────────────────────────────────────────────────────
export const categorySchema = z.object({
  name: z.string({ required_error: 'Category name is required.' }).trim().min(3, { message: 'Category name must be at least 3 characters.' }).max(120),
  description: z.string().trim().max(255).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
  colour: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: 'Choose a valid hex colour such as #1d4ed8.' })
    .optional()
    .nullable(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

export const wardSchema = z.object({
  name: z.string({ required_error: 'Ward name is required.' }).trim().min(2, { message: 'Ward name must be at least 2 characters.' }).max(120),
  code: z.string({ required_error: 'Ward code is required.' }).trim().min(1).max(24).transform((v) => v.toUpperCase()),
  village: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  active: z.boolean().optional(),
});

// ── Reports & analytics ─────────────────────────────────────────────────────
export const reportQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  categoryId: optionalId,
  wardId: optionalId,
  officerId: optionalId,
  status: z.enum([...STATUS_VALUES, 'all']).optional(),
  priority: z.enum([...PRIORITY_VALUES, 'all']).optional(),
});

export const analyticsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  wardId: optionalId,
  categoryId: optionalId,
});

export const notificationQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const trackQuerySchema = z.object({
  complaintId: z.string().trim().max(40).optional(),
  rationNumber: z.string().trim().max(32).optional(),
});
