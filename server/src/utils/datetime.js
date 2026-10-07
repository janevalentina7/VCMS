/** Date helpers - all API output is ISO-8601 UTC, all display formatting is client side. */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { asIso } from '../db/index.js';

dayjs.extend(utc);

export const toIso = asIso;

export const startOfDay = (value = new Date()) => dayjs(value).utc().startOf('day').toDate();
export const endOfDay = (value = new Date()) => dayjs(value).utc().endOf('day').toDate();

export const parseDate = (value) => {
  if (!value) return null;
  const d = dayjs(value);
  return d.isValid() ? d.toDate() : null;
};

export const daysBetween = (from, to = new Date()) => {
  const a = dayjs(from);
  const b = dayjs(to);
  if (!a.isValid() || !b.isValid()) return null;
  return Math.max(0, b.diff(a, 'day'));
};

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export { dayjs };
export default { toIso, startOfDay, endOfDay, parseDate, daysBetween, dayjs };
