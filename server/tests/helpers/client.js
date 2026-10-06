/**
 * Minimal cookie-aware HTTP client for the integration tests.
 * (Deliberately dependency free - uses the global fetch available in Node 20+.)
 */
export class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  storeCookies(response) {
    const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    raw.forEach((line) => {
      const [pair] = line.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    });
  }

  csrfToken() {
    return this.cookies.get('vcms_csrf') || '';
  }

  async request(method, path, { body, form, headers = {}, skipCsrf = false } = {}) {
    const finalHeaders = { Accept: 'application/json', ...headers };
    if (this.cookies.size) finalHeaders.Cookie = this.cookieHeader();
    if (!['GET', 'HEAD'].includes(method) && !skipCsrf) finalHeaders['x-csrf-token'] = this.csrfToken();

    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      finalHeaders['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, { method, headers: finalHeaders, body: payload });
    this.storeCookies(response);

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.arrayBuffer();
    return { status: response.status, data, headers: response.headers };
  }

  get(path, options) {
    return this.request('GET', path, options);
  }

  post(path, body, options = {}) {
    return this.request('POST', path, { body, ...options });
  }

  put(path, body, options = {}) {
    return this.request('PUT', path, { body, ...options });
  }

  patch(path, body, options = {}) {
    return this.request('PATCH', path, { body, ...options });
  }

  delete(path, options) {
    return this.request('DELETE', path, options);
  }

  /** Bootstraps the CSRF cookie the same way the browser client does. */
  async bootstrap() {
    await this.get('/api/public/csrf');
    return this;
  }
}

export default ApiClient;
