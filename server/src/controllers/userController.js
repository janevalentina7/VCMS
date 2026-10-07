import { asyncHandler, sendOk, sendCreated } from '../utils/http.js';
import * as userService from '../services/userService.js';
import * as authService from '../services/authService.js';
import { recordAudit } from '../middleware/audit.js';
import { forbidden } from '../utils/errors.js';

export const list = asyncHandler(async (req, res) => {
  const result = await userService.list(req.validatedQuery ?? req.query);
  return sendOk(res, result.items, undefined, { pagination: result.pagination });
});

export const get = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id) throw forbidden('You can only view your own profile.');
  return sendOk(res, await userService.getById(id));
});

export const create = asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  await recordAudit({ userId: req.user.id, action: 'user.create', entity: 'users', entityId: user.id, meta: { role: user.role }, ip: req.ip });
  return sendCreated(res, user, 'The user account has been created.');
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.update(Number(req.params.id), req.body, req.user);
  await recordAudit({ userId: req.user.id, action: 'user.update', entity: 'users', entityId: user.id, meta: req.body, ip: req.ip });
  return sendOk(res, user, 'User details updated successfully.');
});

export const setStatus = asyncHandler(async (req, res) => {
  const user = await userService.setStatus(Number(req.params.id), req.body.status, req.user);
  await recordAudit({ userId: req.user.id, action: `user.${req.body.status}`, entity: 'users', entityId: user.id, ip: req.ip });
  return sendOk(res, user, req.body.status === 'active' ? 'The account has been activated.' : 'The account has been deactivated.');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await userService.remove(Number(req.params.id), req.user);
  await recordAudit({ userId: req.user.id, action: 'user.delete', entity: 'users', entityId: result.id, ip: req.ip });
  return sendOk(res, result, 'The user account has been deleted.');
});

export const officers = asyncHandler(async (req, res) => {
  const list = await userService.listOfficers({
    wardId: req.validatedQuery?.wardId ?? null,
    includeInactive: req.validatedQuery?.includeInactive === 'true',
  });
  return sendOk(res, list);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user, req.body);
  return sendOk(res, user, 'Your profile has been updated.');
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const user = await userService.updateAvatar(req.user, req.uploadedImage);
  return sendOk(res, user, 'Your profile picture has been updated.');
});

export const getPreferences = asyncHandler(async (req, res) => {
  const row = await userService.getPreferences(req.user.id);
  return sendOk(res, {
    complaintNotifications: Boolean(row.complaint_notifications),
    assignmentNotifications: Boolean(row.assignment_notifications),
    resolutionNotifications: Boolean(row.resolution_notifications),
    emailNotifications: Boolean(row.email_notifications),
    smsNotifications: Boolean(row.sms_notifications),
  });
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const row = await userService.updatePreferences(req.user.id, req.body);
  return sendOk(
    res,
    {
      complaintNotifications: Boolean(row.complaint_notifications),
      assignmentNotifications: Boolean(row.assignment_notifications),
      resolutionNotifications: Boolean(row.resolution_notifications),
      emailNotifications: Boolean(row.email_notifications),
      smsNotifications: Boolean(row.sms_notifications),
    },
    'Notification preferences saved.',
  );
});

export const stats = asyncHandler(async (_req, res) => {
  const [roles, preferences] = await Promise.all([userService.countsByRole(), Promise.resolve(null)]);
  return sendOk(res, { byRole: roles, preferences });
});

export const sessionsOf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id) throw forbidden('You can only view your own sessions.');
  return sendOk(res, await authService.listSessions(id, null));
});

export default {
  list,
  get,
  create,
  update,
  setStatus,
  remove,
  officers,
  updateProfile,
  uploadAvatar,
  getPreferences,
  updatePreferences,
  stats,
  sessionsOf,
};
