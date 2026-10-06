/**
 * Authentication service.
 *
 * - Passwords are hashed with bcrypt (never stored or logged in plain text).
 * - Access tokens are short lived JWTs (15 min by default) delivered as
 *   httpOnly cookies; refresh tokens are random 256-bit strings whose SHA-256
 *   hash is persisted in `sessions`, so a leaked database cannot be replayed
 *   and any session can be revoked instantly.
 * - Login is intentionally vague about *which* credential was wrong to avoid
 *   account enumeration, and rate limited at the route layer.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config/env.js';
import { db } from '../db/index.js';
import { ROLES } from '../config/constants.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../utils/errors.js';
import { publicUser, selfUser, session as serializeSession } from '../utils/serializers.js';
import { logger } from '../utils/logger.js';
import * as notifications from './notificationService.js';
import { recordAudit } from '../middleware/audit.js';

const BCRYPT_ROUNDS = config.isProd ? 12 : 10;

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

/** SHA-256 digest used to store refresh tokens at rest. */
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const loadUserWithWard = (id) =>
  db('users as u').leftJoin('wards as w', 'w.id', 'u.ward_id').where('u.id', id).first('u.*', 'w.name as ward_name', 'w.code as ward_code');

const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, name: user.name }, config.auth.accessSecret, {
    expiresIn: config.auth.accessTtl,
    issuer: 'vcms-api',
    audience: 'vcms-client',
  });

/** Creates a session row + refresh token pair for a user. */
export const issueSession = async (user, req, { remember = false } = {}) => {
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const days = remember ? Math.max(config.auth.refreshTtlDays, 30) : config.auth.refreshTtlDays;
  const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);

  await db('sessions').insert({
    user_id: user.id,
    refresh_token_hash: digest(refreshToken),
    user_agent: String(req.headers['user-agent'] || '').slice(0, 255) || null,
    ip_address: req.ip || null,
    expires_at: expiresAt,
    last_seen_at: new Date(),
    created_at: new Date(),
  });

  return { accessToken: signAccessToken(user), refreshToken, expiresAt, refreshDays: days };
};

export const cookieOptions = (req, { maxAgeMs } = {}) => {
  const secure =
    config.cookies.secure === 'auto'
      ? req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https'
      : Boolean(config.cookies.secure);
  return {
    httpOnly: true,
    sameSite: config.cookies.sameSite,
    secure,
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
};

/** Attaches auth cookies to the response. */
export const setAuthCookies = (req, res, { accessToken, refreshToken, refreshDays }) => {
  res.cookie(config.cookies.accessName, accessToken, cookieOptions(req, { maxAgeMs: config.auth.accessTtlSeconds * 1000 }));
  res.cookie(config.cookies.refreshName, refreshToken, cookieOptions(req, { maxAgeMs: refreshDays * 24 * 3600 * 1000 }));
};

export const clearAuthCookies = (req, res) => {
  const base = cookieOptions(req);
  res.clearCookie(config.cookies.accessName, base);
  res.clearCookie(config.cookies.refreshName, base);
};

export const getUserPreferences = async (userId) => {
  const row = await db('notification_preferences').where({ user_id: userId }).first();
  return row || null;
};

export const register = async (payload, req) => {
  const email = payload.email.toLowerCase();
  const existing = await db('users').where({ email }).orWhere({ mobile: payload.mobile });
  if (existing.length) {
    const clash = existing.find((u) => u.email === email) ? 'email address' : 'mobile number';
    throw conflict(`This ${clash} is already registered. Try signing in instead.`);
  }
  if (payload.rationNumber) {
    const rationClash = await db('users').where({ ration_number: payload.rationNumber }).first();
    if (rationClash) throw conflict('This ration number is already linked to another account.');
  }

  const passwordHash = await hashPassword(payload.password);

  const result = await db.transaction(async (trx) => {
    const [{ id }] = await trx('users')
      .insert({
        name: payload.name,
        email,
        mobile: payload.mobile,
        password_hash: passwordHash,
        ration_number: payload.rationNumber ?? null,
        role: ROLES.CITIZEN, // self registration can never elevate privileges
        ward_id: payload.wardId ?? null,
        address: payload.address ?? null,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');
    const userId = typeof id === 'object' ? id.id : id;
    await trx('notification_preferences').insert({
      user_id: userId,
      complaint_notifications: true,
      assignment_notifications: true,
      resolution_notifications: true,
      email_notifications: false,
      sms_notifications: false,
    });
    return userId;
  });

  const user = await loadUserWithWard(result);
  await notifications.notifyUserWelcome(db, user);
  await recordAudit({ userId: user.id, action: 'user.register', entity: 'users', entityId: user.id, ip: req.ip });

  const tokens = await issueSession(user, req);
  logger.info(`new citizen registered: ${user.email}`);
  return { user: selfUser(user, await getUserPreferences(user.id)), ...tokens };
};

/** Resolve a login identifier to a user row (email, mobile or ration number). */
const findByIdentifier = async (identifier) => {
  const value = String(identifier).trim();
  const lower = value.toLowerCase();
  const compact = value.replace(/[\s-]/g, '');
  return db('users as u')
    .leftJoin('wards as w', 'w.id', 'u.ward_id')
    .where('u.email', lower)
    .orWhere('u.mobile', compact)
    .orWhereRaw("UPPER(COALESCE(u.ration_number, '')) = ?", [compact.toUpperCase()])
    .first('u.*', 'w.name as ward_name', 'w.code as ward_code');
};

export const login = async ({ identifier, password, remember }, req) => {
  const user = await findByIdentifier(identifier);
  const genericError = unauthorized('Invalid credentials. Please check your email / mobile number and password.');

  if (!user) {
    // Constant-ish work factor to blunt user enumeration timing attacks.
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    throw genericError;
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await recordAudit({ userId: user.id, action: 'auth.login_failed', entity: 'users', entityId: user.id, ip: req.ip });
    throw genericError;
  }
  if (user.status !== 'active') {
    throw forbidden(
      user.status === 'suspended'
        ? 'Your account has been suspended. Please contact the village office for assistance.'
        : 'Your account is inactive. Please contact the village office to reactivate it.',
    );
  }

  await db('users').where({ id: user.id }).update({ last_login_at: new Date() });
  const tokens = await issueSession(user, req, { remember });
  await recordAudit({ userId: user.id, action: 'auth.login', entity: 'users', entityId: user.id, ip: req.ip });

  return { user: selfUser(user, await getUserPreferences(user.id)), ...tokens };
};

export const refresh = async (refreshToken, req) => {
  if (!refreshToken) throw unauthorized('Your session has expired. Please sign in again.', { reason: 'SESSION_EXPIRED' });
  const hash = digest(refreshToken);
  const row = await db('sessions').where({ refresh_token_hash: hash }).first();
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw unauthorized('Your session has expired. Please sign in again.', { reason: 'SESSION_EXPIRED' });
  }
  const user = await loadUserWithWard(row.user_id);
  if (!user || user.status !== 'active') throw unauthorized('Your session is no longer valid.');

  // Rotate the refresh token on every use (detects replay of stolen tokens).
  const nextToken = crypto.randomBytes(48).toString('hex');
  const days = Math.max(1, Math.round((new Date(row.expires_at).getTime() - Date.now()) / 86400000));
  await db('sessions')
    .where({ id: row.id })
    .update({
      refresh_token_hash: digest(nextToken),
      last_seen_at: new Date(),
      expires_at: new Date(Date.now() + days * 24 * 3600 * 1000),
    });

  return {
    user: selfUser(user, await getUserPreferences(user.id)),
    accessToken: signAccessToken(user),
    refreshToken: nextToken,
    refreshDays: days,
  };
};

export const logout = async (refreshToken, userId) => {
  if (refreshToken) {
    await db('sessions')
      .where({ refresh_token_hash: digest(refreshToken) })
      .update({ revoked_at: new Date() });
  } else if (userId) {
    await db('sessions').where({ user_id: userId, revoked_at: null }).update({ revoked_at: new Date() });
  }
  return true;
};

export const logoutAll = async (userId) => {
  const count = await db('sessions').where({ user_id: userId, revoked_at: null }).update({ revoked_at: new Date() });
  return Number(count || 0);
};

export const listSessions = async (userId, currentRefreshToken) => {
  const currentHash = currentRefreshToken ? digest(currentRefreshToken) : null;
  const rows = await db('sessions')
    .where({ user_id: userId })
    .whereNull('revoked_at')
    .andWhere('expires_at', '>', new Date())
    .orderBy('created_at', 'desc');
  return rows.map((row) => serializeSession({ ...row, current: currentHash && row.refresh_token_hash === currentHash }));
};

export const revokeSession = async (userId, sessionId) => {
  const row = await db('sessions').where({ id: sessionId, user_id: userId }).first();
  if (!row) throw notFound('Session not found.');
  await db('sessions').where({ id: sessionId, user_id: userId }).update({ revoked_at: new Date() });
  return { id: sessionId };
};

export const changePassword = async (user, { currentPassword, newPassword }, req) => {
  const row = await db('users').where({ id: user.id }).first();
  const ok = await verifyPassword(currentPassword, row.password_hash);
  if (!ok) throw badRequest('Your current password is incorrect.', [{ field: 'currentPassword', message: 'Your current password is incorrect.' }]);

  await db('users').where({ id: user.id }).update({ password_hash: await hashPassword(newPassword), updated_at: new Date() });
  // Invalidate every other session; the caller keeps their own by logging in again.
  await logoutAll(user.id);
  await recordAudit({ userId: user.id, action: 'auth.password_changed', entity: 'users', entityId: user.id, ip: req.ip });
  return true;
};

export const currentUser = async (user) => ({
  user: selfUser(user, await getUserPreferences(user.id)),
  permissions: permissionsFor(user.role),
});

/** Coarse permission map consumed by the client for nav + route guards. */
export const permissionsFor = (role) => {
  const base = {
    'complaints.create': true,
    'complaints.track': true,
    'complaints.viewOwn': true,
    'notifications.manage': true,
    'profile.manage': true,
  };
  if (role === ROLES.CITIZEN) return base;
  if (role === ROLES.OFFICER) {
    return {
      ...base,
      'complaints.viewAssigned': true,
      'complaints.updateStatus': true,
      'complaints.addRemarks': true,
      'officer.statistics': true,
    };
  }
  return {
    ...base,
    'complaints.viewAll': true,
    'complaints.approve': true,
    'complaints.assign': true,
    'complaints.updateStatus': true,
    'complaints.addRemarks': true,
    'complaints.delete': true,
    'users.manage': true,
    'categories.manage': true,
    'wards.manage': true,
    'analytics.view': true,
    'reports.generate': true,
    'settings.manage': true,
  };
};

export default {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  listSessions,
  revokeSession,
  changePassword,
  currentUser,
  permissionsFor,
  issueSession,
  setAuthCookies,
  clearAuthCookies,
  hashPassword,
  verifyPassword,
};
