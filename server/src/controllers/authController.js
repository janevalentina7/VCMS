import { asyncHandler, sendOk, sendCreated } from '../utils/http.js';
import config from '../config/env.js';
import * as authService from '../services/authService.js';
import { ensureCsrfToken } from '../middleware/csrf.js';
import { unauthorized } from '../utils/errors.js';

const withCookies = (req, res, result) => {
  authService.setAuthCookies(req, res, result);
  ensureCsrfToken(req, res);
  return {
    user: result.user,
    accessToken: result.accessToken,
    expiresAt: new Date(Date.now() + config.auth.accessTtlSeconds * 1000).toISOString(),
  };
};

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req);
  return sendCreated(res, withCookies(req, res, result), 'Your account has been created successfully.');
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req);
  return sendOk(res, withCookies(req, res, result), `Welcome back, ${result.user.name}.`);
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[config.cookies.refreshName] || req.body?.refreshToken;
  const result = await authService.refresh(token, req);
  authService.setAuthCookies(req, res, result);
  return sendOk(res, {
    user: result.user,
    accessToken: result.accessToken,
    expiresAt: new Date(Date.now() + config.auth.accessTtlSeconds * 1000).toISOString(),
  });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[config.cookies.refreshName];
  await authService.logout(token, req.user?.id);
  authService.clearAuthCookies(req, res);
  return sendOk(res, null, 'You have been signed out.');
});

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw unauthorized('Please sign in to continue.');
  const data = await authService.currentUser(req.user);
  ensureCsrfToken(req, res);
  return sendOk(res, { ...data, branding: await (await import('../services/settingsService.js')).branding() });
});

export const sessions = asyncHandler(async (req, res) => {
  const token = req.cookies?.[config.cookies.refreshName];
  return sendOk(res, await authService.listSessions(req.user.id, token));
});

export const revokeSession = asyncHandler(async (req, res) => {
  await authService.revokeSession(req.user.id, Number(req.params.id));
  return sendOk(res, null, 'The selected session has been signed out.');
});

export const logoutAll = asyncHandler(async (req, res) => {
  const count = await authService.logoutAll(req.user.id);
  authService.clearAuthCookies(req, res);
  return sendOk(res, { revoked: count }, 'All other sessions have been signed out.');
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user, req.body, req);
  authService.clearAuthCookies(req, res);
  return sendOk(res, null, 'Your password has been changed. Please sign in again with your new password.');
});

export default { register, login, refresh, logout, me, sessions, revokeSession, logoutAll, changePassword };
