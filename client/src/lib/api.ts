/**
 * Typed REST client.
 *
 *  - Cookies (httpOnly access + refresh) are sent with every request, so the
 *    browser never handles raw credentials.
 *  - The CSRF cookie is echoed back in the `x-csrf-token` header for writes,
 *    matching the server's double-submit check.
 *  - A 401 with SESSION_EXPIRED triggers one silent refresh + retry.
 */
import type { ApiErrorShape, FieldErrors } from '@/types';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { field: string; message: string }[];

  constructor(status: number, payload: ApiErrorShape) {
    super(payload?.message || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code || 'ERROR';
    this.details = payload?.details;
  }

  /** Field -> message map for inline form errors. */
  get fieldErrors(): FieldErrors {
    if (!this.details?.length) return {};
    return this.details.reduce<FieldErrors>((acc, detail) => {
      acc[detail.field] = detail.message;
      return acc;
    }, {});
  }

  get isSessionExpired() {
    return this.status === 401 && (this.code === 'SESSION_EXPIRED' || this.code === 'UNAUTHORIZED');
  }
}

const readCookie = (name: string): string => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : '';
};

export const buildQuery = (params: Record<string, string | number | boolean | undefined | null>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  retryOnExpiry?: boolean;
  raw?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

/** Ensures the CSRF cookie exists before the first mutating request. */
export const bootstrapCsrf = async () => {
  if (readCookie('vcms_csrf')) return readCookie('vcms_csrf');
  try {
    const res = await fetch(`${API_BASE}/public/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data?.data?.csrfToken ?? readCookie('vcms_csrf');
  } catch {
    return '';
  }
};

const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => {
          refreshPromise = null;
        }, 50);
      });
  }
  return refreshPromise;
};

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, signal, retryOnExpiry = true, raw = false } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (!['GET', 'HEAD'].includes(method)) {
    const token = readCookie('vcms_csrf') || (await bootstrapCsrf());
    if (token) headers['x-csrf-token'] = token;
  }

  let payload: BodyInit | undefined;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload,
    credentials: 'include',
    signal,
  });

  if (response.status === 401 && retryOnExpiry) {
    const cloned = response.clone();
    const errorPayload = await cloned.json().catch(() => ({}));
    const expired = errorPayload?.error?.code === 'SESSION_EXPIRED';
    if (expired && (await refreshSession())) {
      return request<T>(path, { ...options, retryOnExpiry: false });
    }
    throw new ApiError(401, errorPayload?.error ?? { code: 'UNAUTHORIZED', message: 'Your session has expired. Please sign in again.' });
  }

  if (response.status === 204) return undefined as T;

  if (raw) {
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new ApiError(response.status, errorPayload.error);
    }
    return response as unknown as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw new ApiError(response.status, { code: 'UNEXPECTED_RESPONSE', message: 'The server returned an unexpected response.' });
    return (await response.text()) as unknown as T;
  }

  const json = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, json?.error ?? { code: 'ERROR', message: 'Request failed.' });
  }
  return json.data as T;
}

export interface ApiMeta {
  pagination?: import('@/types').Pagination;
  unreadCount?: number;
  [key: string]: unknown;
}

/** Convenience facade with the JSON payload + pagination meta intact. */
export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
  /** Returns the parsed envelope so callers can read `meta.pagination`. */
  getWithMeta: async <T>(path: string, signal?: AbortSignal) => {
    const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' }, credentials: 'include', signal });
    const json = await response.json();
    if (!response.ok) throw new ApiError(response.status, json?.error ?? { code: 'ERROR', message: 'Request failed.' });
    return { data: json.data as T, meta: json.meta as ApiMeta | undefined, message: json.message as string | undefined };
  },
  /** Triggers a browser download for binary endpoints (PDF export). */
  download: async (path: string, fallbackName: string) => {
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new ApiError(response.status, json?.error ?? { code: 'DOWNLOAD_FAILED', message: 'The report could not be generated.' });
    }
    const disposition = response.headers.get('content-disposition') || '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = match?.[1] ?? fallbackName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
};

export default api;
