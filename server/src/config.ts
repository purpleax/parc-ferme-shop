import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = process.env.NODE_ENV ?? 'development';

// Secrets that have shipped in the repo / images. A real deployment must never
// be protected by one of these — anyone can read them and forge admin tokens.
const INSECURE_JWT_SECRETS = new Set([
  'parc-ferme-demo-secret-change-me', // former code default
  'change-me-for-your-demo', // former docker-compose value
  'change-me',
]);

// Clearly-labelled dev-only fallback so local runs and tests need no config.
// This value is NOT usable in production (guarded below).
const DEV_JWT_SECRET = 'parc-ferme-dev-insecure-secret-do-not-use-in-prod';

function resolveJwtSecret(): string {
  const provided = process.env.JWT_SECRET;
  if (env === 'production') {
    if (!provided || INSECURE_JWT_SECRETS.has(provided) || provided.length < 32) {
      throw new Error(
        'Refusing to start: JWT_SECRET must be a unique, high-entropy value of at least ' +
          '32 characters in production. Generate one with `openssl rand -hex 32` and set ' +
          'JWT_SECRET — never rely on a repo default.'
      );
    }
    return provided;
  }
  // Non-production: honour an operator-provided secret, but never silently use a
  // known-insecure one; otherwise fall back to the dev-only value.
  if (provided && !INSECURE_JWT_SECRETS.has(provided)) return provided;
  return DEV_JWT_SECRET;
}

export const config = {
  env,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: resolveJwtSecret(),
  jwtAlgorithm: 'HS256' as const,
  jwtExpiresIn: '7d' as const,
  dbPath: process.env.DATABASE_PATH ?? path.join(__dirname, '..', 'data', 'store.db'),
  logFile: process.env.LOG_FILE ?? path.join(__dirname, '..', 'logs', 'api.log'),
  photosDir: process.env.PHOTOS_DIR ?? path.join(__dirname, '..', 'public', 'products'),
  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),
  // Opt-in test affordance: forgot-password returns the reset token/link in its
  // response ONLY for emails on this domain (empty = disabled). Lets a bulk test
  // script complete the reset flow without reading server logs. Real accounts
  // (any other domain) never receive a token this way.
  resetTestDomain: (process.env.RESET_TEST_DOMAIN ?? '').trim().toLowerCase().replace(/^@/, ''),
};
