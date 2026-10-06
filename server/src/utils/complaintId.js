/**
 * Complaint reference generator: VCMS-<year>-<6 digit sequence>.
 *
 * The sequence lives in the `complaint_counters` table and is incremented
 * inside the same transaction that inserts the complaint, so concurrent
 * submissions can never produce a duplicate reference. The table's primary
 * key (year) plus the UNIQUE constraint on complaints.complaint_id are the
 * database level guarantee behind it.
 */
import { config } from '../config/env.js';

export const formatComplaintId = (year, sequence, prefix = config.branding.complaintIdPrefix) =>
  `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;

export const currentYear = () => new Date().getFullYear();

/**
 * Reserve and return the next complaint id. MUST be called with a
 * transaction handle so the counter and the complaint insert commit together.
 */
export async function nextComplaintId(trx, year = currentYear()) {
  await trx('complaint_counters').insert({ year, last_number: 0 }).onConflict('year').ignore();
  await trx('complaint_counters').where({ year }).increment('last_number', 1);
  await trx('complaint_counters').where({ year }).update({ updated_at: new Date() });
  const row = await trx('complaint_counters').where({ year }).first('last_number');
  return formatComplaintId(year, Number(row?.last_number ?? 1));
}

/** Split a reference back into its parts (used by validators / tests). */
export const parseComplaintId = (reference) => {
  const match = /^([A-Z]{2,6})-(\d{4})-(\d{4,8})$/.exec(String(reference || '').trim().toUpperCase());
  if (!match) return null;
  return { prefix: match[1], year: Number(match[2]), sequence: Number(match[3]) };
};

export default { nextComplaintId, formatComplaintId, parseComplaintId };
