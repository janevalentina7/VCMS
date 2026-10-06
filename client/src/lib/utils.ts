import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
export const isMobile = (value: string) => /^[6-9]\d{9}$/.test(value.replace(/[\s-]/g, '').replace(/^\+?91/, ''));
export const isRation = (value: string) => /^[A-Z]{2}\d{8,12}$/.test(value.trim().toUpperCase().replace(/[\s-]/g, ''));
export const isName = (value: string) => /^[A-Za-z\u0B80-\u0BFF][A-Za-z\u0B80-\u0BFF.\s'-]*$/.test(value.trim()) && value.trim().length >= 2;
export const isStrongPassword = (value: string) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

export const normaliseDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

export const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export const formatDate = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
    ...options,
  }).format(date);
};

export const formatDateTime = (value?: string | null) =>
  formatDate(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

export const formatRelative = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes > 0 ? '' : 'in '}${Math.abs(minutes)} min${Math.abs(minutes) === 1 ? '' : 's'}${minutes > 0 ? ' ago' : ''}`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours > 0 ? '' : 'in '}${Math.abs(hours)} hour${Math.abs(hours) === 1 ? '' : 's'}${hours > 0 ? ' ago' : ''}`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days > 0 ? '' : 'in '}${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}${days > 0 ? ' ago' : ''}`;
  return formatDate(value);
};

export const formatNumber = (value?: number | null) => (value === null || value === undefined ? '—' : new Intl.NumberFormat('en-IN').format(value));

export const formatPercent = (value?: number | null, digits = 1) =>
  value === null || value === undefined ? '—' : `${Number(value).toFixed(digits).replace(/\.0$/, '')}%`;

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Days elapsed since a date, used for SLA hints. */
export const daysSince = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};

export const today = () => new Date().toISOString().slice(0, 10);

export const pluralise = (count: number, singular: string, plural?: string) =>
  `${formatNumber(count)} ${count === 1 ? singular : plural ?? `${singular}s`}`;

export const truncate = (value: string, length = 120) =>
  value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;

/** Debounce helper for search inputs. */
export const debounce = <Args extends unknown[]>(fn: (...args: Args) => void, delay = 350) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** CSV export used by report tables. */
export const toCsv = (rows: Record<string, unknown>[], columns?: string[]) => {
  if (!rows.length) return '';
  const keys = columns ?? Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [keys.join(','), ...rows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\n');
};

export const exportCsv = (rows: Record<string, unknown>[], filename: string, columns?: string[]) => {
  const csv = toCsv(rows, columns);
  if (!csv) return;
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }), filename);
};
