/** Rate limiters - strict on authentication, generous but present elsewhere. */
import rateLimit from 'express-rate-limit';
import config from '../config/env.js';
import { tooManyRequests } from '../utils/errors.js';

const handler = (_req, _res, next) => next(tooManyRequests());

const skipInTest = () => config.isTest;

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.identifier || '').toLowerCase().slice(0, 40)}`,
});

export const writeLimiter = rateLimit({
  windowMs: config.rateLimit.write.windowMs,
  max: config.rateLimit.write.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler,
});

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler,
});

export default { authLimiter, writeLimiter, apiLimiter };
