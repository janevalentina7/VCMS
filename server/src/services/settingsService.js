/**
 * Application settings (key/value, database backed) so administrators can tune
 * workflow behaviour without a redeploy.
 */
import { db } from '../db/index.js';
import { DEFAULT_SETTINGS } from '../config/constants.js';
import config from '../config/env.js';

const cache = new Map();
const CACHE_TTL_MS = 15_000;

export const ensureDefaults = async (trx = db) => {
  const existing = await trx('settings').select('key');
  const known = new Set(existing.map((r) => r.key));
  const missing = DEFAULT_SETTINGS.filter((s) => !known.has(s.key)).map((s) => ({
    key: s.key,
    value: s.value,
    label: s.label,
    group: s.group,
    type: s.type,
    updated_at: new Date(),
  }));
  if (missing.length) await trx('settings').insert(missing).onConflict('key').ignore();
  return missing.length;
};

const readRaw = async (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
  const row = await db('settings').where({ key }).first('value');
  const value = row?.value ?? null;
  cache.set(key, { value, at: Date.now() });
  return value;
};

export const get = async (key, fallback = null) => {
  const value = await readRaw(key);
  return value === null ? fallback : value;
};

export const getBoolean = async (key, fallback = false) => {
  const value = await readRaw(key);
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const getNumber = async (key, fallback = 0) => {
  const value = await readRaw(key);
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const all = async () => {
  const rows = await db('settings').orderBy('group').orderBy('key');
  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    label: r.label ?? r.key,
    group: r.group,
    type: r.type,
    updatedAt: r.updated_at,
  }));
};

/** Grouped view for the Settings page. */
export const grouped = async () => {
  const rows = await all();
  return rows.reduce((acc, row) => {
    acc[row.group] = acc[row.group] || [];
    acc[row.group].push(row);
    return acc;
  }, {});
};

export const updateMany = async (entries) => {
  const results = [];
  await db.transaction(async (trx) => {
    for (const [key, value] of Object.entries(entries)) {
      const existing = await trx('settings').where({ key }).first();
      if (!existing) continue;
      const stringValue = typeof value === 'boolean' ? String(value) : value === null ? null : String(value);
      await trx('settings').where({ key }).update({ value: stringValue, updated_at: new Date() });
      results.push({ key, value: stringValue });
    }
  });
  cache.clear();
  return results;
};

/** Public branding block consumed by the client shell. */
export const branding = async () => ({
  appName: (await get('portal.title', config.branding.appName)),
  organisation: await get('portal.organisation', config.branding.org),
  tagline: await get('portal.tagline', config.branding.tagline),
  complaintPrefix: config.branding.complaintIdPrefix,
  maxUploadMb: config.uploads.maxMb,
});

export const invalidate = (key) => (key ? cache.delete(key) : cache.clear());

export default { ensureDefaults, get, getBoolean, getNumber, all, grouped, updateMany, branding };
