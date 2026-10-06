/**
 * Uniform, client-safe error taxonomy.
 * Every API failure returns { error: { code, message, details? } }.
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = statusCode < 500;
    Error.captureStackTrace?.(this, ApiError);
  }
}

export const badRequest = (message, details) => new ApiError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required.', details) =>
  new ApiError(401, 'UNAUTHORIZED', message, details);
export const sessionExpired = (message = 'Your session has expired. Please sign in again.') =>
  new ApiError(401, 'SESSION_EXPIRED', message);
export const forbidden = (message = 'You do not have permission to perform this action.', details) =>
  new ApiError(403, 'FORBIDDEN', message, details);
export const notFound = (message = 'The requested resource was not found.') =>
  new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message, details) => new ApiError(409, 'CONFLICT', message, details);
export const payloadTooLarge = (message) => new ApiError(413, 'PAYLOAD_TOO_LARGE', message);
export const unprocessable = (message, details) => new ApiError(422, 'VALIDATION_ERROR', message, details);
export const tooManyRequests = (message = 'Too many requests. Please slow down and try again shortly.') =>
  new ApiError(429, 'RATE_LIMITED', message);
export const internal = (message = 'Something went wrong on our side. Please try again.', details) =>
  new ApiError(500, 'INTERNAL_ERROR', message, details);

export default ApiError;
