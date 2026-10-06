/**
 * Central error handling: converts anything thrown inside the app into a
 * consistent, safe JSON envelope. Internal details (stack traces, SQL errors)
 * are logged but never leaked to the client.
 */
import multer from 'multer';
import config from '../config/env.js';
import ApiError from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `No API route matches ${req.method} ${req.originalUrl}.`));
};

// eslint-disable-next-line no-unused-vars
/** Removes files that were uploaded as part of a request that then failed. */
const cleanupUploads = async (req) => {
  const files = req.uploadedImages || [];
  if (!files.length) return;
  const { removeUpload } = await import('./upload.js');
  await Promise.all(files.map((file) => removeUpload(file.url).catch(() => {})));
};

export const errorHandler = async (error, req, res, _next) => {
  await cleanupUploads(req).catch(() => {});
  let status = error.statusCode || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = error.message || 'Something went wrong on our side. Please try again.';
  let details = error.details;

  // Multer (upload) errors
  if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = error.code === 'LIMIT_FILE_SIZE' ? 'PAYLOAD_TOO_LARGE' : 'UPLOAD_ERROR';
    message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `File size exceeds the allowed limit of ${config.uploads.maxMb} MB.`
        : `Image upload failed: ${error.message}`;
  }

  // Knex/database errors - translate the common ones into something actionable.
  if (error.code && typeof error.code === 'string' && /^(SQLITE|23|42|08)/.test(error.code)) {
    const sqliteUnique = error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
    const pgUnique = error.code === '23505';
    const pgFk = error.code === '23503';
    if (sqliteUnique || pgUnique) {
      status = 409;
      code = 'CONFLICT';
      const field = /users\.email|email/.test(error.message)
        ? 'email address'
        : /users\.mobile|mobile/.test(error.message)
          ? 'mobile number'
          : /ration/.test(error.message)
            ? 'ration number'
            : 'value';
      message = `This ${field} is already registered. Please use a different one.`;
    } else if (pgFk) {
      status = 400;
      code = 'INVALID_REFERENCE';
      message = 'A referenced record does not exist or is still in use.';
    } else if (String(error.code).startsWith('42')) {
      status = 500;
      code = 'DB_QUERY_ERROR';
      message = 'The request could not be processed due to a database error.';
    }
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    status = 401;
    code = 'SESSION_EXPIRED';
    message = 'Your session has expired. Please sign in again.';
  }

  const isServerError = status >= 500;
  const logLine = `${req.method} ${req.originalUrl} → ${status} ${code}: ${error.message}`;
  if (isServerError) logger.error(logLine, config.isProd ? undefined : error.stack);
  else logger.debug(logLine);

  res.status(status).json({
    success: false,
    error: {
      code,
      message: isServerError && !error.expose ? 'Something went wrong on our side. Please try again.' : message,
      ...(details ? { details } : {}),
      ...(config.isProd ? {} : { path: req.originalUrl }),
    },
  });
};

export default errorHandler;
