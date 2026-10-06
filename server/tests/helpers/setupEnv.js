/**
 * Test environment bootstrap.
 *
 * Imported as the very first statement of every test file: ESM evaluates
 * imports in order, so these variables are in place before `src/config/env.js`
 * (and therefore the knex instance) is loaded.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.HTTP_LOG = 'false';
process.env.LOG_LEVEL = 'error';

const file = path.join(os.tmpdir(), `vcms-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_FILENAME = file;
process.env.DB_CLIENT = 'better-sqlite3';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_0123456789_0123456789_abcdef';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_0123456789_0123456789_abcdef';

export const databaseFile = file;

export const removeTestDatabase = () => {
  ['', '-journal', '-wal', '-shm'].forEach((suffix) => fs.rmSync(`${file}${suffix}`, { force: true }));
};

export default { databaseFile, removeTestDatabase };
