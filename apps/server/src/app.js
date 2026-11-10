/**
 * Builds the Express application without starting a server, so Supertest can
 * load it directly. server.js adds the database connection and the port.
 */
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { setRuntime } from './config/runtime.js';
import { createMailer } from './integrations/mail/index.js';
import { createLocalDiskStorage } from './integrations/storage/localDiskStorage.js';
import { buildApiRouter } from './routes/index.js';
import { createLocalQueue } from './integrations/queue/localQueue.js';
import { createMatchWorker } from './workers/matchWorker.js';
import { processRequest, onDeadMessage } from './services/matching/matchingService.js';
import { expireStaleRequests, QUEUE_NAME } from './services/requestService.js';
import { originCheck } from './middleware/originCheck.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { sendSuccess } from './utils/respond.js';

export function createApp(config, overrides = {}) {
  const mailer = overrides.mailer ?? createMailer(config);
  const storage = overrides.storage ?? createLocalDiskStorage({ rootDir: config.uploadDir, publicPath: '/uploads' });
  // SB2/US48–50: local queue + worker that copy the SQS/Lambda design without AWS.
  const queue =
    overrides.queue ??
    createLocalQueue({
      visibilitySeconds: config.QUEUE_VISIBILITY_SECONDS,
      maxReceives: config.QUEUE_MAX_RECEIVES,
      onDead: onDeadMessage,
    });
  const worker = createMatchWorker({
    queue,
    queueName: QUEUE_NAME,
    processMessage: (body, now) => processRequest(body.requestId, now),
    expire: () => expireStaleRequests(),
    intervalMs: config.MATCH_WORKER_INTERVAL_MS,
    expiryIntervalMs: config.EXPIRY_JOB_INTERVAL_MS,
  });
  setRuntime({ config, mailer, storage, queue, worker });

  const app = express();
  app.disable('x-powered-by');
  app.locals.runtime = { config, mailer, storage, queue, worker };

  // 1. Security headers. HSTS only when the app is really served over HTTPS (SB1/US45).
  app.use(
    helmet({
      hsts: config.HTTPS ? { maxAge: 15552000, includeSubDomains: true } : false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.HTTPS ? [] : null,
        },
      },
    }),
  );

  // 2. CORS: only the configured client origin(s), with cookies.
  app.use(cors({ origin: config.clientOrigins, credentials: true }));

  // 3. Body + cookies.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // 4. Request log (development).
  if (config.LOG_REQUESTS && !config.isTest) app.use(requestLogger);

  // 5. Uploaded files (profile photos) and API routes.
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', index: false }));
  app.use('/api/v1', originCheck(config.clientOrigins));
  app.use('/api/v1', buildApiRouter(config));

  // Interactive API docs in development (docs/api/openapi.yaml).
  if (!config.isProduction && fs.existsSync(config.openApiPath)) {
    const spec = YAML.parse(fs.readFileSync(config.openApiPath, 'utf8'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'SkillBridge API' }));
  }

  // Test-only email outbox for Playwright (never mounted in production).
  if (config.enableTestRoutes && mailer.kind === 'memory') {
    app.get('/api/test/emails/latest', (req, res) => sendSuccess(res, { email: mailer.latestTo(req.query.to) }));
  }

  app.use('/api', notFound);

  // Production: serve the built React app and let the client router handle paths.
  if (config.serveClient && fs.existsSync(config.clientDistDir)) {
    app.use(express.static(config.clientDistDir, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(config.clientDistDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
