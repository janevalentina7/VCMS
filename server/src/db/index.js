/**
 * Knex instance (singleton) + small dialect-aware helpers.
 *
 * The application talks to the database exclusively through Knex query
 * builders / parameter binding - never through string concatenation - which
 * makes SQL injection structurally impossible and keeps the same codebase
 * portable between SQLite (development) and PostgreSQL (production).
 */
import fs from 'node:fs';
import path from 'node:path';
import knexFactory from 'knex';
import config, { SERVER_ROOT } from '../config/env.js';
import { logger } from '../utils/logger.js';

const buildConfig = () => {
  if (config.db.client === 'pg') {
    return {
      client: 'pg',
      connection: config.db.url
        ? { connectionString: config.db.url, ssl: config.isProd ? { rejectUnauthorized: false } : false }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 5432),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'vcms',
          },
      pool: config.db.pool,
      acquireConnectionTimeout: 10_000,
    };
  }

  const filename = config.db.filename;
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });

  return {
    client: 'better-sqlite3',
    connection: { filename },
    useNullAsDefault: true,
    pool: {
      min: 0,
      max: 1,
      afterCreate: (conn, done) => {
        try {
          conn.pragma('journal_mode = WAL');
          conn.pragma('foreign_keys = ON');
          conn.pragma('busy_timeout = 5000');
        } catch {
          /* pragmas are best-effort */
        }
        done(null, conn);
      },
    },
  };
};

export const db = knexFactory(buildConfig());

/** True when running on PostgreSQL. */
export const isPostgres = config.db.client === 'pg';

/**
 * Boolean bind helpers. better-sqlite3 refuses boolean bind parameters while
 * PostgreSQL needs real booleans, so queries that compare boolean columns use
 * these constants: `db.raw('?', [TRUE])`.
 */
export const TRUE = isPostgres ? true : 1;
export const FALSE = isPostgres ? false : 0;

/** Case-insensitive LIKE/ILIKE helper that works on both dialects. */
export const ilike = (column, value) =>
  isPostgres ? db.raw('?? ILIKE ?', [column, value]) : db.raw('LOWER(??) LIKE LOWER(?)', [column, value]);

/**
 * Normalises any dialect-specific timestamp into an ISO-8601 UTC string.
 *
 * Dialect notes:
 *  - PostgreSQL returns real `Date` objects.
 *  - The SQLite (better-sqlite3) driver stores timestamps as epoch
 *    milliseconds, so reads come back as numbers.
 *  - Raw string values ('YYYY-MM-DD HH:MM:SS') are treated as UTC.
 */
export const asIso = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();

  const numeric = typeof value === 'number' ? value : /^-?\d+$/.test(String(value).trim()) ? Number(value) : null;
  if (numeric !== null && Number.isFinite(numeric)) {
    // Guard against second-precision epochs (10 digits) vs milliseconds (13).
    const ms = Math.abs(numeric) < 1e11 ? numeric * 1000 : numeric;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const raw = String(value).trim();
  const normalised = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const parsed = new Date(normalised);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
};

/** Current timestamp stored consistently across dialects. */
export const now = () => new Date();

export async function assertDatabaseConnection() {
  try {
    await db.raw('select 1 as ok');
    const rows = await db('knex_migrations').count({ c: '*' }).first();
    const count = Number(rows?.c ?? 0);
    if (count === 0) {
      logger.warn('database is reachable but has no migrations applied - run `npm run db:migrate`');
    }
    logger.info(`database connected (${config.db.client}) - ${count} migration(s) applied`);
  } catch (error) {
    logger.error(`database connection failed: ${error.message}`);
    throw error;
  }
}

export async function closeDatabase() {
  await db.destroy();
}

/** Runs `fn` inside a transaction (SQLite) / pooled tx (PostgreSQL). */
export const transaction = (fn) => db.transaction(fn);

export default db;
