/**
 * Application entry point: boots the HTTP server, verifies the database and
 * wires graceful shutdown.
 */
import { createApp } from './app.js';
import config from './config/env.js';
import { assertDatabaseConnection, closeDatabase } from './db/index.js';
import { ensureDefaults } from './services/settingsService.js';
import { subdir } from './middleware/upload.js';
import { logger } from './utils/logger.js';

const start = async () => {
  try {
    await assertDatabaseConnection();
    await ensureDefaults();
    subdir('complaints');
    subdir('avatars');
    subdir('tmp');

    const app = createApp();
    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info(`VCMS API listening on http://0.0.0.0:${config.port} (${config.env})`);
      logger.info(`database: ${config.db.client === 'pg' ? 'postgres' : `sqlite (${config.db.filename})`}`);
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received - shutting down gracefully`);
      server.close(async () => {
        await closeDatabase().catch(() => {});
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 8000).unref();
    };

    ['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));
    process.on('unhandledRejection', (reason) => logger.error(`unhandled rejection: ${reason}`));
    process.on('uncaughtException', (error) => {
      logger.error(`uncaught exception: ${error.message}`, error.stack);
      process.exitCode = 1;
    });

    return server;
  } catch (error) {
    logger.error(`failed to start server: ${error.message}`, error.stack);
    process.exit(1);
  }
};

start();
