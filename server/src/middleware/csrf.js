/**
 * Double-submit cookie CSRF protection.
 *
 * The SPA receives a readable `vcms_csrf` cookie and must echo it back in the
 * `x-csrf-token` header for every mutating request. Because the access token
 * cookie is httpOnly + SameSite=Lax, a cross-site form post cannot read the
 * CSRF cookie, so it cannot forge the header.
 *
 * Requests authenticated with an explicit Bearer token (CLI, tests, future
 * mobile app) are exempt - they are not cookie-authenticated and therefore not
 * vulnerable to CSRF.
 */
import crypto from 'node:crypto';
import config from '../config/env.js';
import { forbidden } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const csrfCookieOptions = () => ({
  httpOnly: false,
  sameSite: config.cookies.sameSite,
  secure: config.cookies.secure === true,
  path: '/',
});

/**
 * Ensures the client holds a CSRF cookie and returns the token.
 * (Plain helper - controllers call it directly; `csrfTokenMiddleware` wires it
 * into the express chain.)
 */
export const ensureCsrfToken = (req, res) => {
  const existing = req.cookies?.[config.cookies.csrfName];
  if (existing && existing.length >= 32) return existing;
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie(config.cookies.csrfName, token, { ...csrfCookieOptions(), maxAge: config.auth.refreshTtlDays * 24 * 3600 * 1000 });
  return token;
};

export const csrfProtection = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  // Bearer-token clients are not cookie based => not CSRF susceptible.
  if ((req.headers.authorization || '').startsWith('Bearer ')) return next();
  const cookieToken = req.cookies?.[config.cookies.csrfName];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(
      forbidden('Your security token is missing or invalid. Refresh the page and try again.', {
        reason: 'CSRF_FAILED',
      }),
    );
  }
  return next();
};

/** Express middleware flavour: always continues the chain. */
export const csrfTokenMiddleware = (req, res, next) => {
  ensureCsrfToken(req, res);
  next();
};

export { csrfCookieOptions };
export default { csrfProtection, ensureCsrfToken, csrfTokenMiddleware };
