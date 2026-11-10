/**
 * Entry point: load config → connect MongoDB → start HTTP(S) server.
 *   npm run dev:server   (development, auto-restart)
 *   npm start            (production mode, also serves the built client)
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { loadEnvFiles, buildConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

async function main() {
  loadEnvFiles();
  const config = buildConfig(process.env);

  try {
    await connectDatabase(config.MONGODB_URI);
  } catch (err) {
    logger.error(
      `Could not connect to MongoDB at ${config.MONGODB_URI}.\n` +
        '  • Is MongoDB running?  macOS: brew services start mongodb-community\n' +
        `  • Details: ${err.message}`,
    );
    process.exit(1);
  }

  const app = createApp(config);
  let server;
  if (config.HTTPS) {
    if (!fs.existsSync(config.sslCertPath) || !fs.existsSync(config.sslKeyPath)) {
      logger.error('HTTPS is on but the certificate files are missing. See README → "Local HTTPS".');
      process.exit(1);
    }
    server = https.createServer(
      { cert: fs.readFileSync(config.sslCertPath), key: fs.readFileSync(config.sslKeyPath) },
      app,
    );
  } else {
    server = http.createServer(app);
  }

  // Background matching worker and 60-second expiry job (SB2/US44, US49).
  app.locals.runtime.worker.start();

  server.listen(config.PORT, () => {
    const scheme = config.HTTPS ? 'https' : 'http';
    logger.info(`SkillBridge API listening on ${scheme}://localhost:${config.PORT}`);
    if (!config.isProduction) logger.info(`API docs: ${scheme}://localhost:${config.PORT}/api/docs`);
    if (config.serveClient) logger.info(`Serving the built client from ${config.clientDistDir}`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down…`);
    app.locals.runtime.worker.stop();
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error(err.code === 'CONFIG_INVALID' ? err.message : err);
  process.exit(1);
});
