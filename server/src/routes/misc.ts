import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { conflict } from '../errors.js';
import { parse } from '../middleware.js';

const router = Router();

const startedAt = Date.now();

router.get('/health', (_req, res) => {
  const productCount = (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n;
  res.json({
    status: 'ok',
    service: 'parc-ferme-api',
    version: '1.0.0',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    database: productCount > 0 ? 'seeded' : 'empty',
  });
});

// Classic bot-attractive endpoint (rate limiting handled at the edge by Fastly).
const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});

router.post('/newsletter', (req, res) => {
  const body = parse(newsletterSchema, req.body);
  const existing = db.prepare('SELECT id FROM newsletter_subscribers WHERE email = ?').get(body.email);
  if (existing) throw conflict('ALREADY_SUBSCRIBED', 'This email is already subscribed');
  db.prepare('INSERT INTO newsletter_subscribers (email) VALUES (?)').run(body.email);
  res.status(201).json({ subscribed: true, email: body.email });
});

export default router;
