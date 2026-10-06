/**
 * Express application assembly.
 *
 * Layered deliberately: infrastructure (helmet/cors/parsers/logging/limits) →
 * static assets → API → SPA fallback → 404 → error handler.
 */
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config, { SERVER_ROOT, UPLOAD_ROOT } from './config/env.js';
import apiRoutes from './routes/index.js';
import { authenticate } from './middleware/auth.js';
import { csrfProtection, csrfTokenMiddleware } from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

export const createApp = () => {
  const app = express();

  // Behind the platform's TLS proxy: needed for correct req.ip + secure cookies.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ── Security headers ─────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          // The SPA is served by Vite in development and from dist in production;
          // inline styles are required by Recharts/SVG rendering.
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'", 'https:'],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploaded evidence images
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: config.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────────
  const allowList = config.cors.origins;
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true); // same-origin / server-to-server
        if (allowList.includes(origin)) return callback(null, true);
        if (!config.isProd && allowList.length === 0) return callback(null, true); // dev convenience
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: ['Content-Disposition', 'X-Total-Count'],
      maxAge: 600,
    }),
  );

  // ── Parsers / logging ──────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  if (config.logging.http) {
    app.use(
      morgan(config.isProd ? 'combined' : 'dev', {
        skip: (req) => req.path === '/api/health',
        stream: { write: (line) => logger.info(line.trim()) },
      }),
    );
  }

  // ── Static uploads ─────────────────────────────────────────────────────
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  app.use(
    config.uploads.publicPath,
    express.static(UPLOAD_ROOT, {
      maxAge: '7d',
      immutable: false,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  // ── Health ─────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: { status: 'ok', env: config.env, uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() },
    });
  });

  // ── API ────────────────────────────────────────────────────────────────
  app.use('/api', apiLimiter, authenticate, csrfTokenMiddleware, csrfProtection, apiRoutes);

  // ── SPA (production build) ─────────────────────────────────────────────
  const clientDist = path.resolve(SERVER_ROOT, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
    logger.info(`serving client build from ${clientDist}`);
  } else {
    app.get('/', (_req, res) =>
      res.json({
        success: true,
        message: 'VCMS API is running. The client dev server (npm run dev) serves the UI on another port.',
        data: { health: '/api/health', endpoints: '/api' },
      }),
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
