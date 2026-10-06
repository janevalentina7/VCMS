/** Response helpers + async route wrapper (no unhandled promise rejections). */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const sendOk = (res, data = null, message = undefined, meta = undefined) =>
  res.status(200).json({ success: true, ...(message ? { message } : {}), data, ...(meta ? { meta } : {}) });

export const sendCreated = (res, data, message) =>
  res.status(201).json({ success: true, ...(message ? { message } : {}), data });

export const sendNoContent = (res) => res.status(204).send();

export const ok = sendOk;
export const created = sendCreated;

export default { ok, created, sendNoContent, asyncHandler };
