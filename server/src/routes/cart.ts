import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { parse } from '../middleware.js';
import { imageUrl } from './helpers.js';

const router = Router();

const cartIdSchema = z.string().uuid('Invalid cart id');
const addItemSchema = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().min(1).max(10),
});
const updateItemSchema = z.object({ qty: z.number().int().min(1).max(10) });

interface CartItemRow {
  id: number;
  product_id: number;
  qty: number;
  name: string;
  slug: string;
  image_seed: string;
  price_cents: number;
  stock: number;
  active: number;
}

export function loadCart(cartId: string) {
  const cart = db.prepare('SELECT id FROM carts WHERE id = ?').get(cartId);
  if (!cart) return null;
  const items = db
    .prepare(`
      SELECT ci.id, ci.product_id, ci.qty, p.name, p.slug, p.image_seed, p.price_cents, p.stock, p.active
      FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ? ORDER BY ci.id
    `)
    .all(cartId) as CartItemRow[];
  const mapped = items.map((i) => ({
    id: i.id,
    productId: i.product_id,
    name: i.name,
    slug: i.slug,
    image: imageUrl(i.image_seed),
    priceCents: i.price_cents,
    qty: i.qty,
    lineTotalCents: i.price_cents * i.qty,
    stock: i.stock,
  }));
  const subtotal = mapped.reduce((s, i) => s + i.lineTotalCents, 0);
  return {
    id: cartId,
    items: mapped,
    itemCount: mapped.reduce((s, i) => s + i.qty, 0),
    subtotalCents: subtotal,
  };
}

router.post('/', (_req, res) => {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO carts (id) VALUES (?)').run(id);
  res.status(201).json({ cart: loadCart(id) });
});

router.get('/:cartId', (req, res) => {
  const cartId = parse(cartIdSchema, req.params.cartId);
  const cart = loadCart(cartId);
  if (!cart) throw notFound('Cart');
  res.json({ cart });
});

router.post('/:cartId/items', (req, res) => {
  const cartId = parse(cartIdSchema, req.params.cartId);
  const body = parse(addItemSchema, req.body);
  if (!db.prepare('SELECT id FROM carts WHERE id = ?').get(cartId)) throw notFound('Cart');

  const product = db
    .prepare('SELECT id, stock, active FROM products WHERE id = ?')
    .get(body.productId) as { id: number; stock: number; active: number } | undefined;
  if (!product || !product.active) throw notFound('Product');

  const existing = db
    .prepare('SELECT id, qty FROM cart_items WHERE cart_id = ? AND product_id = ?')
    .get(cartId, body.productId) as { id: number; qty: number } | undefined;
  const newQty = (existing?.qty ?? 0) + body.qty;
  if (newQty > product.stock) {
    throw badRequest(`Only ${product.stock} in stock`, [{ field: 'qty', message: 'Insufficient stock' }]);
  }
  if (newQty > 10) throw badRequest('Maximum 10 of each item per order');

  if (existing) {
    db.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (cart_id, product_id, qty) VALUES (?, ?, ?)').run(
      cartId, body.productId, body.qty
    );
  }
  db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cartId);
  res.status(201).json({ cart: loadCart(cartId) });
});

router.patch('/:cartId/items/:itemId', (req, res) => {
  const cartId = parse(cartIdSchema, req.params.cartId);
  const itemId = parse(z.coerce.number().int().positive(), req.params.itemId);
  const body = parse(updateItemSchema, req.body);

  const item = db
    .prepare(`
      SELECT ci.id, p.stock FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.id = ? AND ci.cart_id = ?
    `)
    .get(itemId, cartId) as { id: number; stock: number } | undefined;
  if (!item) throw notFound('Cart item');
  if (body.qty > item.stock) {
    throw badRequest(`Only ${item.stock} in stock`, [{ field: 'qty', message: 'Insufficient stock' }]);
  }
  db.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').run(body.qty, itemId);
  res.json({ cart: loadCart(cartId) });
});

router.delete('/:cartId/items/:itemId', (req, res) => {
  const cartId = parse(cartIdSchema, req.params.cartId);
  const itemId = parse(z.coerce.number().int().positive(), req.params.itemId);
  const result = db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(itemId, cartId);
  if (Number(result.changes) === 0) throw notFound('Cart item');
  res.json({ cart: loadCart(cartId) });
});

router.delete('/:cartId', (req, res) => {
  const cartId = parse(cartIdSchema, req.params.cartId);
  if (!db.prepare('SELECT id FROM carts WHERE id = ?').get(cartId)) throw notFound('Cart');
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
  res.json({ cart: loadCart(cartId) });
});

export default router;
