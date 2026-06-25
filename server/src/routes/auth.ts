import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { conflict, invalidCredentials, notFound } from '../errors.js';
import { parse, requireAuth, signToken } from '../middleware.js';
import type { AuthUser } from '../types.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'customer' | 'admin';
  created_at: string;
}

const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  createdAt: u.created_at,
});

router.post('/register', (req, res) => {
  const body = parse(registerSchema, req.body);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email);
  if (existing) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');

  const hash = bcrypt.hashSync(body.password, 10);
  const result = db
    .prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'customer')")
    .run(body.email, hash, body.name);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as UserRow;
  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const body = parse(loginSchema, req.body);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email) as UserRow | undefined;
  if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
    throw invalidCredentials();
  }
  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const me = req.user as AuthUser;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id) as UserRow | undefined;
  if (!user) throw notFound('User');
  res.json({ user: publicUser(user) });
});

export default router;
