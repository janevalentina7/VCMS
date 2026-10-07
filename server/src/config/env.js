/**
 * Centralised, validated environment configuration.
 * Every value has a safe default so the project boots out-of-the-box,
 * while production deployments are forced to provide real secrets.
 */
import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '../..');

const bool = (v, dflt = false) => {
  if (v === undefined || v === '') return dflt;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const int = (v, dflt) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : dflt;
};

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

/** Dev-only fallback secrets: random per boot, so they can never leak into production. */
const devSecret = (label) => {
  if (isProd) return null;
  const generated = crypto.randomBytes(32).toString('hex');
  if (!isTest) {
    // eslint-disable-next-line no-console
    console.warn(
      `[config] ${label} not set - generated an ephemeral development secret. ` +
        'Sessions will not survive a server restart. Set it in server/.env for a stable dev session.',
    );
  }
  return generated;
};

const accessSecret = process.env.JWT_ACCESS_SECRET || devSecret('JWT_ACCESS_SECRET');
const refreshSecret = process.env.JWT_REFRESH_SECRET || devSecret('JWT_REFRESH_SECRET');

if (isProd) {
  const missing = [
    ['JWT_ACCESS_SECRET', accessSecret],
    ['JWT_REFRESH_SECRET', refreshSecret],
  ].filter(([, v]) => !v || v.length < 32);
  if (missing.length) {
    throw new Error(
      `Refusing to start in production without strong secrets: ${missing.map(([k]) => k).join(', ')}`,
    );
  }
}

const DB_CLIENT = process.env.DB_CLIENT || 'better-sqlite3';
const sqliteFile = process.env.DB_FILENAME || './data/vcms.sqlite';

export const config = {
  env: NODE_ENV,
  isProd,
  isTest,
  port: int(process.env.PORT, 4000),
  apiPrefix: '/api',

  db: {
    client: DB_CLIENT,
    filename: path.isAbsolute(sqliteFile) ? sqliteFile : path.resolve(SERVER_ROOT, sqliteFile),
    url: process.env.DATABASE_URL || null,
    pool: { min: 0, max: int(process.env.DB_POOL_MAX, isProd ? 10 : 1) },
  },

  auth: {
    accessSecret,
    refreshSecret,
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    accessTtlSeconds: int(process.env.ACCESS_TOKEN_TTL_SECONDS, 15 * 60),
    refreshTtlDays: int(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
  },

  cookies: {
    // auto => Secure flag follows the request protocol (proxy aware)
    secure: process.env.COOKIE_SECURE === 'auto' || !process.env.COOKIE_SECURE
      ? 'auto'
      : bool(process.env.COOKIE_SECURE, isProd),
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    accessName: 'vcms_at',
    refreshName: 'vcms_rt',
    csrfName: 'vcms_csrf',
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxBytes: int(process.env.MAX_UPLOAD_MB, 5) * 1024 * 1024,
    maxMb: int(process.env.MAX_UPLOAD_MB, 5),
    allowedMime: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    allowedExt: ['.jpg', '.jpeg', '.png', '.webp'],
    publicPath: '/uploads',
  },

  branding: {
    appName: process.env.APP_NAME || 'Village Complaint Management System',
    org: process.env.APP_ORG || 'Government of Tamil Nadu',
    tagline: process.env.APP_TAGLINE || 'Digital Grievance Redressal Portal',
    complaintIdPrefix: process.env.COMPLAINT_ID_PREFIX || 'VCMS',
  },

  rateLimit: {
    auth: { windowMs: 15 * 60 * 1000, max: int(process.env.RL_AUTH_MAX, 25) },
    api: { windowMs: 60 * 1000, max: int(process.env.RL_API_MAX, 600) },
    write: { windowMs: 60 * 1000, max: int(process.env.RL_WRITE_MAX, 60) },
  },

  logging: {
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    http: process.env.HTTP_LOG !== 'false' && !isTest,
  },

  /** Optional integrations - stubbed so future SMS/email/AI plug in without refactoring. */
  integrations: {
    smtpUrl: process.env.SMTP_URL || null,
    smsApiKey: process.env.SMS_API_KEY || null,
    aiClassifierUrl: process.env.AI_CLASSIFIER_URL || null,
  },
};

/** Resolve the uploads directory as an absolute path. */
export const UPLOAD_ROOT = path.isAbsolute(config.uploads.dir)
  ? config.uploads.dir
  : path.resolve(SERVER_ROOT, config.uploads.dir);

export default config;
