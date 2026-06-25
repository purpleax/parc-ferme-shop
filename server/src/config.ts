import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'parc-ferme-demo-secret-change-me',
  jwtExpiresIn: '7d' as const,
  dbPath: process.env.DATABASE_PATH ?? path.join(__dirname, '..', 'data', 'store.db'),
  logFile: process.env.LOG_FILE ?? path.join(__dirname, '..', 'logs', 'api.log'),
  photosDir: process.env.PHOTOS_DIR ?? path.join(__dirname, '..', 'public', 'products'),
  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),
};
