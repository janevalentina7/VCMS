/**
 * Knex configuration.
 *
 * Development / preview : better-sqlite3 (zero-config, file based)
 * Production            : PostgreSQL  (set DB_CLIENT=pg + DATABASE_URL)
 *
 * A single, portable migration set is shared by both dialects.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './src/config/env.js';

const migrationDir = path.resolve('src/db/migrations');
const seedDir = path.resolve('src/db/seeds');

const sqlite = () => {
  fs.mkdirSync(path.dirname(config.db.filename), { recursive: true });
  return {
    client: 'better-sqlite3',
    connection: { filename: config.db.filename },
    useNullAsDefault: true,
    pool: { min: 0, max: 1, afterCreate: (conn, done) => {
      conn.pragma('journal_mode = WAL');
      conn.pragma('foreign_keys = ON');
      done(null, conn);
    } },
  };
};

const postgres = () => ({
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
});

/** @type {import('knex').Knex.Config} */
const shared = {
  migrations: { directory: migrationDir, tableName: 'knex_migrations' },
  seeds: { directory: seedDir },
};

const active = config.db.client === 'pg' ? postgres() : sqlite();

export default {
  development: { ...active, ...shared },
  test: { ...active, ...shared },
  production: { ...active, ...shared },
};
