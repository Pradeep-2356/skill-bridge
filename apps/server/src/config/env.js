/**
 * Loads and validates configuration once at start-up.
 * The server refuses to start with a missing or weak JWT secret (Stage 3 decision).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '../..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '../..');

const bool = (fallback) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/skillbridge_dev'),
  JWT_ACCESS_SECRET: z
    .string({ error: 'JWT_ACCESS_SECRET is missing. Run `npm run setup` to create a .env file.' })
    .min(32, { error: 'JWT_ACCESS_SECRET must be at least 32 characters. Run `npm run setup`.' }),
  ACCESS_TOKEN_TTL: z
    .string()
    .regex(/^\d+[smhd]$/)
    .default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(180).default(30),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  COOKIE_SECURE: bool(false),
  HTTPS: bool(false),
  SSL_CERT_PATH: z.string().default('certs/localhost.pem'),
  SSL_KEY_PATH: z.string().default('certs/localhost-key.pem'),
  MAIL_TRANSPORT: z.enum(['smtp', 'console', 'memory']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  MAIL_FROM: z.string().default('SkillBridge <no-reply@skillbridge.test>'),
  UPLOAD_DIR: z.string().default('apps/server/uploads'),
  MAX_AVATAR_MB: z.coerce.number().min(0.1).max(10).default(2),
  SERVE_CLIENT: bool(false),
  ENABLE_TEST_ROUTES: bool(false),
  LOG_REQUESTS: bool(true),
});

/** Pure builder so tests can create a config without touching process.env. */
export function buildConfig(env = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`);
    const err = new Error(`Invalid server configuration:\n${lines.join('\n')}`);
    err.code = 'CONFIG_INVALID';
    throw err;
  }
  const cfg = result.data;
  const resolveFromRepo = (p) => (path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p));
  return Object.freeze({
    ...cfg,
    isProduction: cfg.NODE_ENV === 'production',
    isTest: cfg.NODE_ENV === 'test',
    clientOrigins: cfg.CLIENT_ORIGIN.split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
    uploadDir: resolveFromRepo(cfg.UPLOAD_DIR),
    sslCertPath: resolveFromRepo(cfg.SSL_CERT_PATH),
    sslKeyPath: resolveFromRepo(cfg.SSL_KEY_PATH),
    clientDistDir: path.resolve(REPO_ROOT, 'apps/client/dist'),
    openApiPath: path.resolve(REPO_ROOT, 'docs/api/openapi.yaml'),
    cookieSecure: cfg.COOKIE_SECURE || cfg.HTTPS,
    serveClient: cfg.SERVE_CLIENT || cfg.NODE_ENV === 'production',
    enableTestRoutes: cfg.ENABLE_TEST_ROUTES && cfg.NODE_ENV !== 'production',
  });
}

/** Loads `.env` from the repo root (then apps/server) without overriding real env vars. */
export function loadEnvFiles() {
  for (const file of [path.join(REPO_ROOT, '.env'), path.join(SERVER_ROOT, '.env')]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // A missing file is fine; validation below reports anything required.
    }
  }
}

/** Parses durations like "15m" or "2h" into milliseconds. */
export function durationToMs(value) {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return Number(match[1]) * unit;
}
