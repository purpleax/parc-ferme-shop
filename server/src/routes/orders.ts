import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { badRequest, forbidden, notFound, paymentDeclined } from '../errors.js';
import { asyncHandler, parse, requireAuth } from '../middleware.js';
import { imageUrl, orderId } from './helpers.js';
import type { AuthUser } from '../types.js';

export const ordersRouter = Router();
export const paymentsRouter = Router();

ordersRouter.use(requireAuth);
paymentsRouter.use(requireAuth);

const FREE_SHIPPING_THRESHOLD = 25000;
const SHIPPING_CENTS = 800;
const TAX_RATE = 0.08;

// ---------- Orders ----------

const createOrderSchema = z.object({
  cartId: z.string().uuid(),
  shipping: z.object({
    name: z.string().trim().min(2).max(80),
    line1: z.string().trim().min(3).max(120),
    line2: z.string().trim().max(120).optional(),
    city: z.string().trim().min(2).max(80),
    postalCode: z.string().trim().min(3).max(12),
    country: z.string().trim().min(2).max(60),
  }),
});

interface OrderRow {
  id: string;
  user_id: number;
  cart_id: string | null;
  status: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  ship_name: string;
  ship_line1: string;
  ship_line2: string | null;
  ship_city: string;
  ship_postal: string;
  ship_country: string;
  created_at: string;
}

export function mapOrder(row: OrderRow, opts: { includeItems?: boolean } = {}) {
  const base = {
    id: row.id,
    status: row.status,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    shipping: {
      name: row.ship_name,
      line1: row.ship_line1,
      line2: row.ship_line2,
      city: row.ship_city,
      postalCode: row.ship_postal,
      country: row.ship_country,
    },
    createdAt: row.created_at,
  };
  if (!opts.includeItems) return base;
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id')
    .all(row.id) as { id: number; product_id: number; name: string; image_seed: string; price_cents: number; qty: number }[];
  const payment = db
    .prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1")
    .get(row.id) as { id: string; card_brand: string | null; card_last4: string | null } | undefined;
  return {
    ...base,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.name,
      image: i.image_seed ? imageUrl(i.image_seed) : null,
      priceCents: i.price_cents,
      qty: i.qty,
      lineTotalCents: i.price_cents * i.qty,
    })),
    payment: payment
      ? { id: payment.id, cardBrand: payment.card_brand, cardLast4: payment.card_last4 }
      : null,
  };
}

ordersRouter.post('/', (req, res) => {
  const user = req.user as AuthUser;
  const body = parse(createOrderSchema, req.body);

  const items = db
    .prepare(`
      SELECT ci.product_id, ci.qty, p.name, p.slug, p.price_cents, p.stock, p.active
      FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ?
    `)
    .all(body.cartId) as { product_id: number; qty: number; name: string; slug: string; price_cents: number; stock: number; active: number }[];

  if (!db.prepare('SELECT id FROM carts WHERE id = ?').get(body.cartId)) throw notFound('Cart');
  if (items.length === 0) throw badRequest('Your cart is empty');
  for (const item of items) {
    if (!item.active) throw badRequest(`"${item.name}" is no longer available`);
    if (item.qty > item.stock) {
      throw badRequest(`Only ${item.stock} of "${item.name}" left in stock`);
    }
  }

  const subtotal = items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CENTS;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + shipping + tax;
  const id = orderId();

  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (id, user_id, cart_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents,
        ship_name, ship_line1, ship_line2, ship_city, ship_postal, ship_country)
      VALUES (?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, user.id, body.cartId, subtotal, shipping, tax, total,
      body.shipping.name, body.shipping.line1, body.shipping.line2 ?? null,
      body.shipping.city, body.shipping.postalCode, body.shipping.country
    );
    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, name, image_seed, price_cents, qty) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const i of items) insertItem.run(id, i.product_id, i.name, i.slug, i.price_cents, i.qty);
  });
  create();

  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow;
  res.status(201).json({ order: mapOrder(row, { includeItems: true }) });
});

ordersRouter.get('/', (req, res) => {
  const user = req.user as AuthUser;
  const rows = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id) as OrderRow[];
  res.json({ orders: rows.map((r) => mapOrder(r, { includeItems: true })) });
});

ordersRouter.get('/:id', (req, res) => {
  const user = req.user as AuthUser;
  const id = parse(z.string().min(4).max(20), req.params.id);
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
  if (!row) throw notFound('Order');
  if (row.user_id !== user.id && user.role !== 'admin') throw forbidden();
  res.json({ order: mapOrder(row, { includeItems: true }) });
});

// ---------- Mock payments ----------
// Card data is validated, used to derive brand + last4, and immediately discarded.
// Test cards: 4242424242424242 succeeds, 4000000000000002 declines,
// 4000000000009995 fails with insufficient_funds.

const intentSchema = z.object({ orderId: z.string().min(4).max(20) });

const confirmSchema = z.object({
  card: z.object({
    number: z
      .string()
      .transform((s) => s.replace(/[\s-]/g, ''))
      .pipe(z.string().regex(/^\d{13,19}$/, 'Card number must be 13–19 digits')),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(2000).max(2099),
    cvc: z.string().regex(/^\d{3,4}$/, 'CVC must be 3–4 digits'),
    name: z.string().trim().min(2).max(80),
  }),
});

function luhnValid(number: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

const cardBrand = (number: string) =>
  number.startsWith('4') ? 'visa' : number.startsWith('5') ? 'mastercard' : number.startsWith('3') ? 'amex' : 'card';

paymentsRouter.post('/intent', (req, res) => {
  const user = req.user as AuthUser;
  const body = parse(intentSchema, req.body);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(body.orderId) as OrderRow | undefined;
  if (!order) throw notFound('Order');
  if (order.user_id !== user.id) throw forbidden();
  if (order.status !== 'pending_payment') {
    throw badRequest(`Order is ${order.status} and cannot be paid again`);
  }
  const id = `pay_${crypto.randomBytes(8).toString('hex')}`;
  db.prepare('INSERT INTO payments (id, order_id, amount_cents) VALUES (?, ?, ?)').run(
    id, order.id, order.total_cents
  );
  res.status(201).json({
    payment: { id, orderId: order.id, amountCents: order.total_cents, status: 'requires_confirmation' },
  });
});

paymentsRouter.post('/:paymentId/confirm', asyncHandler(async (req, res) => {
  const user = req.user as AuthUser;
  const paymentId = parse(z.string().startsWith('pay_').max(40), req.params.paymentId);
  const body = parse(confirmSchema, req.body);

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as
    | { id: string; order_id: string; status: string; amount_cents: number }
    | undefined;
  if (!payment) throw notFound('Payment');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payment.order_id) as OrderRow;
  if (order.user_id !== user.id) throw forbidden();
  if (payment.status !== 'requires_confirmation') {
    throw badRequest(`Payment already ${payment.status}`);
  }
  // Several intents can exist for one order; once any of them succeeds the
  // order must not be payable again through the others.
  if (order.status !== 'pending_payment') {
    throw badRequest(`Order is ${order.status} and cannot be paid again`);
  }

  const { number, expMonth, expYear } = body.card;
  if (!luhnValid(number)) {
    throw badRequest('Invalid card number', [{ field: 'card.number', message: 'Card number failed validation' }]);
  }
  const now = new Date();
  if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
    throw badRequest('Card has expired', [{ field: 'card.expYear', message: 'Expiry date is in the past' }]);
  }

  // Simulate processor latency for realistic demo traffic.
  await new Promise((resolve) => setTimeout(resolve, 400));

  const declineCode =
    number === '4000000000000002' ? 'card_declined' :
    number === '4000000000009995' ? 'insufficient_funds' : null;

  if (declineCode) {
    db.prepare("UPDATE payments SET status = 'declined', decline_code = ? WHERE id = ?").run(
      declineCode, paymentId
    );
    throw paymentDeclined(
      declineCode,
      declineCode === 'insufficient_funds'
        ? 'Your card has insufficient funds'
        : 'Your card was declined'
    );
  }

  const last4 = number.slice(-4);
  const brand = cardBrand(number);
  const finalize = db.transaction(() => {
    // The pre-checks above ran before the simulated-latency await, so a
    // concurrent confirm may have finalized in the meantime. The conditional
    // updates make exactly one confirm win; the loser rolls back untouched.
    const claimed = db.prepare(
      "UPDATE payments SET status = 'succeeded', card_brand = ?, card_last4 = ? WHERE id = ? AND status = 'requires_confirmation'"
    ).run(brand, last4, paymentId);
    const paid = db.prepare(
      "UPDATE orders SET status = 'paid' WHERE id = ? AND status = 'pending_payment'"
    ).run(order.id);
    if (Number(claimed.changes) === 0 || Number(paid.changes) === 0) {
      throw badRequest('Order has already been paid');
    }
    const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(order.id) as
      { product_id: number; qty: number }[];
    const decrement = db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?');
    for (const i of items) decrement.run(i.qty, i.product_id);
    if (order.cart_id) db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(order.cart_id);
  });
  finalize();

  res.json({
    payment: {
      id: paymentId,
      orderId: order.id,
      status: 'succeeded',
      amountCents: payment.amount_cents,
      cardBrand: brand,
      cardLast4: last4,
    },
  });
}));
