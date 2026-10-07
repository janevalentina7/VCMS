/**
 * Shared visibility scope helper.
 *
 * Kept in its own module to avoid a circular import between the complaint and
 * analytics services.
 */
import { ROLES } from '../config/constants.js';

export const applyComplaintScope = (query, user, alias = 'c') => {
  if (!user) return query.whereRaw('1 = 0');
  if (user.role === ROLES.ADMIN) return query;
  if (user.role === ROLES.OFFICER) return query.where(`${alias}.assigned_officer_id`, user.id);
  return query.where(`${alias}.citizen_id`, user.id);
};

export default { applyComplaintScope };
