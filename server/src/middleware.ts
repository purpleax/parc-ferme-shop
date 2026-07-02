import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { z, ZodSchema } from 'zod';
import { config } from './config.js';
import { ApiError, badRequest, forbidden, unauthorized } from './errors.js';
import type { AuthUser } from './types.js';

// ---------- Request ID + security headers ----------

export function requestId(req: Request, res: Response, next: NextFunction) {
  // Honour a caller-supplied id (CDN tracing) but never echo arbitrary bytes
  // into logs/headers — anything unexpected gets replaced, not sanitised.
  const supplied = req.headers['x-request-id'];
  req.id =
    typeof supplied === 'string' && /^[\w.-]{1,64}$/.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

// ---------- Structured request logging ----------

let logStream: fs.WriteStream | null = null;
function getLogStream(): fs.WriteStream | null {
  if (config.dbPath === ':memory:') return null; // tests
  if (!logStream) {
    fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
    logStream = fs.createWriteStream(config.logFile, { flags: 'a' });
  }
  return logStream;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (!req.path.startsWith('/api')) return;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const entry = {
      ts: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      ip: req.ip,
      userId: req.user?.id ?? null,
      role: req.user?.role ?? 'anonymous',
      authEvent: (res.getHeader('X-Auth-Event') as string) ?? null,
      userAgent: req.headers['user-agent'] ?? '',
    };
    // Human-readable console line + JSON file line (logs/api.log)
    const color = res.statusCode >= 500 ? 31 : res.statusCode >= 400 ? 33 : 32;
    console.log(
      `\x1b[2m${entry.ts}\x1b[0m \x1b[${color}m${entry.status}\x1b[0m ${entry.method.padEnd(6)} ${entry.path} \x1b[2m${entry.durationMs}ms req=${entry.requestId.slice(0, 8)} user=${entry.userId ?? '-'}\x1b[0m`
    );
    getLogStream()?.write(JSON.stringify(entry) + '\n');
  });
  next();
}

// ---------- Auth ----------

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: String(user.id), email: user.email, name: user.name, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, algorithm: config.jwtAlgorithm }
  );
}

function parseToken(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret, {
      algorithms: [config.jwtAlgorithm],
    }) as jwt.JwtPayload;
    return {
      id: Number(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role === 'admin' ? 'admin' : 'customer',
    };
  } catch {
    return null;
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const user = parseToken(req);
  if (user) req.user = user;
  next();
}

// ---------- Cache control ----------

// Per-user and mutating API responses must never be cached by a CDN (Fastly),
// or an edge HIT serves stale/cross-user data — e.g. an admin stock edit that
// "doesn't save" because the refetch is served from cache. Public catalogue
// GETs are left cacheable on purpose (CDN cache-hit-ratio demos). Mount under
// `/api`, so req.path here is the route without the `/api` prefix.
//
// `private` is deliberate alongside `no-store`: Fastly's default VCL ignores
// `no-store` (no max-age → falls back to default_ttl and caches it), but it
// passes on `private` — so `private` is what actually stops the edge caching,
// while `no-store` covers browser/intermediary caches.
const NO_STORE_PREFIXES = ['/admin', '/auth', '/cart', '/orders', '/payments'];

export function apiCacheControl(req: Request, res: Response, next: NextFunction) {
  const isMutation = req.method !== 'GET' && req.method !== 'HEAD';
  const isSensitivePath = NO_STORE_PREFIXES.some((p) => req.path.startsWith(p));
  if (req.user || isMutation || isSensitivePath) {
    res.setHeader('Cache-Control', 'private, no-store');
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden('Admin access required'));
  next();
}

// Express 4 doesn't forward rejected promises to the error handler.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ---------- Validation ----------

export function parse<S extends ZodSchema>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.') || '(root)',
      message: i.message,
    }));
    throw badRequest('Request validation failed', details);
  }
  return result.data;
}

// ---------- Error handling ----------

export function apiNotFound(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}`, requestId: req.id },
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details, requestId: req.id },
    });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON', requestId: req.id },
    });
    return;
  }
  console.error(`[error] req=${req.id}`, err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId: req.id },
  });
}
