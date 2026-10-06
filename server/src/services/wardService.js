/** Wards / village divisions. */
import { db } from '../db/index.js';
import { conflict, notFound } from '../utils/errors.js';
import { ward as serialize } from '../utils/serializers.js';

export const list = async ({ includeInactive = false, withCounts = false } = {}) => {
  const query = db('wards');
  if (!includeInactive) query.where('active', true);
  const rows = await query.clone().orderBy('code');
  if (!withCounts) return rows.map(serialize);

  const [complaintRows, officerRows] = await Promise.all([
    db('complaints').groupBy('ward_id').select('ward_id').count({ total: 'id' }),
    db('users').where({ role: 'officer' }).groupBy('ward_id').select('ward_id').count({ total: 'id' }),
  ]);
  const complaints = complaintRows.reduce((acc, r) => ({ ...acc, [r.ward_id]: Number(r.total) }), {});
  const officers = officerRows.reduce((acc, r) => ({ ...acc, [r.ward_id]: Number(r.total) }), {});
  return rows.map((row) => serialize({ ...row, complaint_count: complaints[row.id] ?? 0, officer_count: officers[row.id] ?? 0 }));
};

export const getById = async (id) => {
  const row = await db('wards').where({ id }).first();
  if (!row) throw notFound('Ward not found.');
  return serialize(row);
};

export const create = async (payload) => {
  const code = payload.code.toUpperCase();
  const clash = await db('wards').where({ code }).first();
  if (clash) throw conflict(`Ward code "${code}" is already in use.`);
  const [{ id }] = await db('wards')
    .insert({
      name: payload.name.trim(),
      code,
      village: payload.village ?? null,
      description: payload.description ?? null,
      active: payload.active ?? true,
      created_at: new Date(),
    })
    .returning('id');
  return getById(typeof id === 'object' ? id.id : id);
};

export const update = async (id, payload) => {
  const row = await db('wards').where({ id }).first();
  if (!row) throw notFound('Ward not found.');
  const patch = { updated_at: new Date() };
  if (payload.name !== undefined) patch.name = payload.name.trim();
  if (payload.code !== undefined) {
    const code = payload.code.toUpperCase();
    const clash = await db('wards').where({ code }).whereNot({ id }).first();
    if (clash) throw conflict(`Ward code "${code}" is already in use.`);
    patch.code = code;
  }
  if (payload.village !== undefined) patch.village = payload.village;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.active !== undefined) {
    if (!payload.active) {
      const [{ c } = { c: 0 }] = await db('wards').where({ active: true }).whereNot({ id }).count({ c: '*' });
      if (Number(c) === 0) throw conflict('At least one ward must remain active.');
    }
    patch.active = Boolean(payload.active);
  }
  await db('wards').where({ id }).update(patch);
  return getById(id);
};

export default { list, getById, create, update };
