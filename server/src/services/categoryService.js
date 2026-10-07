/** Complaint categories - database driven, manageable by administrators. */
import { db } from '../db/index.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { category as serialize } from '../utils/serializers.js';

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const list = async ({ includeInactive = false, withCounts = false } = {}) => {
  const query = db('categories as cat');
  if (!includeInactive) query.where('cat.active', true);
  const rows = await query.clone().orderBy('cat.sort_order').orderBy('cat.name');

  if (!withCounts) return rows.map(serialize);

  const counts = await db('complaints').groupBy('category_id').select('category_id').count({ total: 'id' });
  const map = counts.reduce((acc, r) => ({ ...acc, [r.category_id]: Number(r.total) }), {});
  return rows.map((row) => serialize({ ...row, complaint_count: map[row.id] ?? 0 }));
};

export const getById = async (id) => {
  const row = await db('categories').where({ id }).first();
  if (!row) throw notFound('Complaint category not found.');
  return serialize(row);
};

export const create = async (payload) => {
  const name = payload.name.trim();
  const existing = await db('categories').whereRaw('LOWER(name) = LOWER(?)', [name]).first();
  if (existing) throw conflict(`A category named "${existing.name}" already exists.`);

  let slug = slugify(name);
  const slugTaken = await db('categories').where({ slug }).first();
  if (slugTaken) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  const [{ id }] = await db('categories')
    .insert({
      name,
      slug,
      description: payload.description ?? null,
      icon: payload.icon || 'CircleAlert',
      colour: payload.colour || '#1d4ed8',
      active: payload.active ?? true,
      sort_order: payload.sortOrder ?? 99,
      created_at: new Date(),
    })
    .returning('id');

  return getById(typeof id === 'object' ? id.id : id);
};

export const update = async (id, payload) => {
  const row = await db('categories').where({ id }).first();
  if (!row) throw notFound('Complaint category not found.');

  const patch = { updated_at: new Date() };
  if (payload.name !== undefined) {
    const name = payload.name.trim();
    const clash = await db('categories').whereRaw('LOWER(name) = LOWER(?)', [name]).whereNot({ id }).first();
    if (clash) throw conflict(`A category named "${clash.name}" already exists.`);
    patch.name = name;
  }
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.icon !== undefined) patch.icon = payload.icon || 'CircleAlert';
  if (payload.colour !== undefined) patch.colour = payload.colour || '#1d4ed8';
  if (payload.active !== undefined) patch.active = Boolean(payload.active);
  if (payload.sortOrder !== undefined) patch.sort_order = payload.sortOrder;

  await db('categories').where({ id }).update(patch);
  return getById(id);
};

/** Prevents deactivating/deleting the last active category. */
const assertNotLastActive = async (id, nextActive) => {
  if (nextActive !== false) return;
  const [{ c } = { c: 0 }] = await db('categories').where({ active: true }).whereNot({ id }).count({ c: '*' });
  if (Number(c) === 0) throw badRequest('At least one complaint category must remain active.');
};

export const setActive = async (id, active) => {
  const row = await db('categories').where({ id }).first();
  if (!row) throw notFound('Complaint category not found.');
  await assertNotLastActive(id, Boolean(active));
  await db('categories').where({ id }).update({ active: Boolean(active), updated_at: new Date() });
  return getById(id);
};

export const remove = async (id) => {
  const row = await db('categories').where({ id }).first();
  if (!row) throw notFound('Complaint category not found.');
  const [{ c } = { c: 0 }] = await db('complaints').where({ category_id: id }).count({ c: '*' });
  if (Number(c) > 0) {
    throw conflict(
      `"${row.name}" is used by ${c} complaint(s) and cannot be deleted. Deactivate it instead to stop new complaints.`,
    );
  }
  await db('categories').where({ id }).del();
  return { id, name: row.name };
};

export default { list, getById, create, update, setActive, remove };
