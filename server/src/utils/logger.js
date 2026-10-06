/** Tiny dependency-free levelled logger with machine-readable structure. */
import config from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLOURS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
const RESET = '\x1b[0m';

const threshold = LEVELS[config.logging.level] ?? LEVELS.info;

const emit = (level, message, meta) => {
  if (LEVELS[level] > threshold) return;
  const stamp = new Date().toISOString();
  const tag = config.isProd ? level.toUpperCase() : `${COLOURS[level]}${level.toUpperCase()}${RESET}`;
  const line = `${stamp} ${tag} ${message}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined && meta !== null) fn(line, typeof meta === 'string' ? meta : JSON.stringify(meta));
  else fn(line);
};

export const logger = {
  error: (m, meta) => emit('error', m, meta),
  warn: (m, meta) => emit('warn', m, meta),
  info: (m, meta) => emit('info', m, meta),
  debug: (m, meta) => emit('debug', m, meta),
  child: () => logger,
};

export default logger;
