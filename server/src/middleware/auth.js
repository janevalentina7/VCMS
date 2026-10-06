/**
 * Authentication & authorization middleware.
 *
 * Strategy: short-lived JWT access token delivered in an httpOnly cookie
 * (fetch credentials: 'include') plus a long-lived, revocable refresh token
 * stored in the `sessions` table. A bearer-token path is also accepted so the
 * API stays usable from CLI tools, tests and future mobile clients.
 */
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { db } from '../db/index.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { publicUser } from '../utils/serializers.js';

/** Extract a token from the Authorization header or the access cookie. */
const extractAccessToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookieName = config.cookies.accessName;
  return req.cookies?.[cookieName] || null;
};

const loadUser = (id) =>
  db('users as u')
    .leftJoin('wards as w', 'w.id', 'u.ward_id')
    .where('u.id', id)
    .first('u.*', 'w.name as ward_name', 'w.code as ward_code');

/**
 * Verifies the access token when present and hydrates req.user.
 * Never throws for anonymous requests - use requireAuth for that.
 */
export const authenticate = async (req, _res, next) => {
  req.user = null;
  const token = extractAccessToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, config.auth.accessSecret, {
      issuer: 'vcms-api',
      audience: 'vcms-client',
    });
    const row = await loadUser(payload.sub);
    if (!row) return next();
    if (row.status !== 'active') {
      return next(forbidden('Your account is not active. Please contact the village office.'));
    }
    req.user = publicUser(row);
    req.accountStatus = row.status;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Surface a distinguishable code so the client can silently refresh.
      req.authError = 'TOKEN_EXPIRED';
      return next();
    }
    req.authError = 'TOKEN_INVALID';
    return next();
  }
};

/** Requires a valid, active session. */
export const requireAuth = (req, _res, next) => {
  if (req.user) return next();
  if (req.authError === 'TOKEN_EXPIRED') {
    return next(unauthorized('Your session has expired. Please sign in again.', { reason: 'SESSION_EXPIRED' }));
  }
  return next(unauthorized('Please sign in to continue.'));
};

/** Requires the caller to hold one of the given roles. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized('Please sign in to continue.'));
  const allowed = roles.flat();
  if (!allowed.includes(req.user.role)) {
    return next(
      forbidden(
        allowed.length === 1 && allowed[0] === 'admin'
          ? 'Administrator access is required for this action.'
          : 'You do not have permission to access this section.',
        { requiredRoles: allowed },
      ),
    );
  }
  return next();
};

/** Attaches req.user when available but never blocks the request. */
export const optionalAuth = authenticate;

/** True when the caller is an administrator. */
export const isAdmin = (req) => req.user?.role === 'admin';

export default { authenticate, requireAuth, requireRole, optionalAuth };
