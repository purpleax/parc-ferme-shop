import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db.js';
import { badRequest, conflict, invalidCredentials, notFound } from '../errors.js';
import { parse, requireAuth, signToken } from '../middleware.js';
import type { AuthUser } from '../types.js';
import type { Response } from 'express';

const router = Router();

// How long a password-reset token stays valid.
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// A single shared password policy, reused by register + reset.
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: passwordField,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  password: passwordField,
});

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'customer' | 'admin';
  created_at: string;
}

interface ResetTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
}

const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  createdAt: u.created_at,
});

// Tag every auth response with an X-Auth-Event header so the Fastly NGWAF
// templated ATO rules (login / registration / password-reset attempt, success,
// failure) can key off the origin's outcome at the edge. One header, one value
// per response, mapping 1:1 to a templated system signal.
function authEvent(res: Response, event: string) {
  res.setHeader('X-Auth-Event', event);
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

router.post('/register', (req, res) => {
  try {
    const body = parse(registerSchema, req.body);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email);
    if (existing) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');

    const hash = bcrypt.hashSync(body.password, 10);
    const result = db
      .prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'customer')")
      .run(body.email, hash, body.name);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as UserRow;
    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    authEvent(res, 'register-success');
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    authEvent(res, 'register-failure');
    throw err;
  }
});

router.post('/login', (req, res) => {
  try {
    const body = parse(loginSchema, req.body);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email) as UserRow | undefined;
    if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
      throw invalidCredentials();
    }
    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    authEvent(res, 'login-success');
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    authEvent(res, 'login-failure');
    throw err;
  }
});

// Step 1 of password reset: request a link. Always responds 200 with an
// identical body regardless of whether the account exists (anti-enumeration —
// the only signal is the X-Auth-Event header). No email is sent; in this demo
// the reset link is logged server-side so an operator can reproduce a success.
router.post('/forgot-password', (req, res) => {
  const body = parse(forgotPasswordSchema, req.body);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email) as UserRow | undefined;

  let rawToken: string | undefined;
  if (user) {
    rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
    // Invalidate any outstanding tokens for this user, then issue a fresh one.
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, sha256(rawToken), expiresAt);
    // Stand-in for an email: log the reset link so it can be exercised in a demo.
    console.log(
      `\x1b[36m[password-reset]\x1b[0m link for ${user.email}: /reset-password?token=${rawToken} (expires ${expiresAt})`
    );
  }

  authEvent(res, 'password-reset-attempt');

  const payload: Record<string, unknown> = {
    message: 'If an account exists for that email, a password reset link has been sent.',
  };
  // Test affordance (opt-in via RESET_TEST_DOMAIN): return the token/link in the
  // response for the configured throwaway domain only, so a bulk script can
  // complete the reset flow without reading server logs. Real accounts on any
  // other domain never receive a token here.
  if (rawToken && config.resetTestDomain && body.email.endsWith(`@${config.resetTestDomain}`)) {
    payload.resetToken = rawToken;
    payload.resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${rawToken}`;
  }
  res.json(payload);
});

// Step 2 of password reset: submit the token + a new password. Any non-success
// exit (bad/expired/used token, weak password) is tagged password-reset-failure.
router.post('/reset-password', (req, res) => {
  try {
    const body = parse(resetPasswordSchema, req.body);
    const row = db
      .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?')
      .get(sha256(body.token)) as ResetTokenRow | undefined;

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw badRequest('This password reset link is invalid or has expired.');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id) as UserRow | undefined;
    if (!user) throw badRequest('This password reset link is invalid or has expired.');

    const hash = bcrypt.hashSync(body.password, 10);
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
      db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(row.id);
    })();

    authEvent(res, 'password-reset-success');
    res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    authEvent(res, 'password-reset-failure');
    throw err;
  }
});

router.get('/me', requireAuth, (req, res) => {
  const me = req.user as AuthUser;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id) as UserRow | undefined;
  if (!user) throw notFound('User');
  res.json({ user: publicUser(user) });
});

export default router;
