import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { conflict, notFound } from '../errors.js';
import { parse, requireAdmin } from '../middleware.js';
import { mapProduct, PRODUCT_SELECT, slugify, type ProductRow } from './helpers.js';
import { mapOrder } from './orders.js';

const router = Router();
router.use(requireAdmin);

// ---------- Dashboard stats ----------

router.get('/stats', (_req, res) => {
  const revenue = (db.prepare(
    "SELECT COALESCE(SUM(total_cents), 0) AS n FROM orders WHERE status IN ('paid','shipped','delivered')"
  ).get() as { n: number }).n;
  const orderCount = (db.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }).n;
  const customerCount = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").get() as { n: number }).n;
  const productCount = (db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1').get() as { n: number }).n;
  const lowStock = db
    .prepare('SELECT id, name, sku, stock FROM products WHERE active = 1 AND stock <= 8 ORDER BY stock ASC LIMIT 6')
    .all();
  const recentOrders = db
    .prepare(`
      SELECT o.id, o.status, o.total_cents, o.created_at, u.name AS customer_name
      FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 6
    `)
    .all() as { id: string; status: string; total_cents: number; created_at: string; customer_name: string }[];
  const topProducts = db
    .prepare(`
      SELECT oi.product_id, oi.name, SUM(oi.qty) AS units, SUM(oi.qty * oi.price_cents) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ('paid','shipped','delivered')
      GROUP BY oi.product_id, oi.name ORDER BY units DESC LIMIT 5
    `)
    .all() as { product_id: number; name: string; units: number; revenue: number }[];

  res.json({
    stats: {
      revenueCents: revenue,
      orderCount,
      customerCount,
      productCount,
      lowStock,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.total_cents,
        createdAt: o.created_at,
        customerName: o.customer_name,
      })),
      topProducts: topProducts.map((p) => ({
        productId: p.product_id,
        name: p.name,
        units: p.units,
        revenueCents: p.revenue,
      })),
    },
  });
});

// ---------- Product management ----------

router.get('/products', (_req, res) => {
  const rows = db.prepare(`${PRODUCT_SELECT} ORDER BY p.created_at DESC`).all() as ProductRow[];
  res.json({ items: rows.map(mapProduct) });
});

const productBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  priceCents: z.number().int().min(50).max(10_000_000),
  compareAtCents: z.number().int().min(50).max(10_000_000).nullable().optional(),
  categoryId: z.number().int().positive(),
  stock: z.number().int().min(0).max(100_000),
  badge: z.string().trim().max(20).nullable().optional(),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
});

function assertCategory(categoryId: number) {
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId)) {
    throw notFound('Category');
  }
}

router.post('/products', (req, res) => {
  const body = parse(productBodySchema, req.body);
  assertCategory(body.categoryId);

  let slug = slugify(body.name);
  if (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  const sku = `PF-CU-${String(Date.now()).slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO products (sku, slug, name, description, price_cents, compare_at_cents,
      category_id, stock, badge, image_seed, featured, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sku, slug, body.name, body.description, body.priceCents, body.compareAtCents ?? null,
    body.categoryId, body.stock, body.badge ?? null, slug, body.featured ? 1 : 0, body.active ? 1 : 0
  );
  const row = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(result.lastInsertRowid) as ProductRow;
  res.status(201).json({ product: mapProduct(row) });
});

router.put('/products/:id', (req, res) => {
  const id = parse(z.coerce.number().int().positive(), req.params.id);
  const body = parse(productBodySchema, req.body);
  assertCategory(body.categoryId);
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) throw notFound('Product');

  db.prepare(`
    UPDATE products SET name = ?, description = ?, price_cents = ?, compare_at_cents = ?,
      category_id = ?, stock = ?, badge = ?, featured = ?, active = ?
    WHERE id = ?
  `).run(
    body.name, body.description, body.priceCents, body.compareAtCents ?? null,
    body.categoryId, body.stock, body.badge ?? null, body.featured ? 1 : 0, body.active ? 1 : 0, id
  );
  const row = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id) as ProductRow;
  res.json({ product: mapProduct(row) });
});

router.delete('/products/:id', (req, res) => {
  const id = parse(z.coerce.number().int().positive(), req.params.id);
  const result = db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
  if (Number(result.changes) === 0) throw notFound('Product');
  res.json({ deleted: true, id, note: 'Product deactivated (soft delete)' });
});

// ---------- Orders ----------

const orderListSchema = z.object({
  status: z.enum(['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

router.get('/orders', (req, res) => {
  const q = parse(orderListSchema, req.query);
  const params: Record<string, string | number> = { limit: q.limit };
  if (q.status) params.status = q.status;
  const rows = db
    .prepare(`
      SELECT o.*, u.name AS customer_name, u.email AS customer_email
      FROM orders o JOIN users u ON u.id = o.user_id
      ${q.status ? 'WHERE o.status = :status' : ''}
      ORDER BY o.created_at DESC LIMIT :limit
    `)
    .all(params) as unknown as (Parameters<typeof mapOrder>[0] & {
      customer_name: string; customer_email: string;
    })[];
  res.json({
    orders: rows.map((r) => ({
      ...mapOrder(r),
      customer: { name: r.customer_name, email: r.customer_email },
    })),
  });
});

router.get('/orders/:id', (req, res) => {
  const id = parse(z.string().min(4).max(20), req.params.id);
  const row = db
    .prepare(`
      SELECT o.*, u.name AS customer_name, u.email AS customer_email
      FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?
    `)
    .get(id) as (Parameters<typeof mapOrder>[0] & { customer_name: string; customer_email: string }) | undefined;
  if (!row) throw notFound('Order');
  res.json({
    order: {
      ...mapOrder(row, { includeItems: true }),
      customer: { name: row.customer_name, email: row.customer_email },
    },
  });
});

const statusSchema = z.object({
  status: z.enum(['pending_payment', 'paid', 'shipped', 'delivered', 'cancelled']),
});

router.patch('/orders/:id', (req, res) => {
  const id = parse(z.string().min(4).max(20), req.params.id);
  const body = parse(statusSchema, req.body);
  const existing = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(id) as
    | { id: string; status: string }
    | undefined;
  if (!existing) throw notFound('Order');
  if (existing.status === 'cancelled' && body.status !== 'cancelled') {
    throw conflict('ORDER_CANCELLED', 'A cancelled order cannot change status');
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(body.status, id);
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Parameters<typeof mapOrder>[0];
  res.json({ order: mapOrder(row, { includeItems: true }) });
});

// ---------- Customers ----------

router.get('/customers', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT u.id, u.email, u.name, u.created_at,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(CASE WHEN o.status IN ('paid','shipped','delivered') THEN o.total_cents END), 0) AS total_spent
      FROM users u LEFT JOIN orders o ON o.user_id = u.id
      WHERE u.role = 'customer'
      GROUP BY u.id ORDER BY u.created_at DESC
    `)
    .all() as { id: number; email: string; name: string; created_at: string; order_count: number; total_spent: number }[];
  res.json({
    customers: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      createdAt: r.created_at,
      orderCount: r.order_count,
      totalSpentCents: r.total_spent,
    })),
  });
});

router.get('/customers/:id', (req, res) => {
  const id = parse(z.coerce.number().int().positive(), req.params.id);
  const user = db
    .prepare("SELECT id, email, name, created_at FROM users WHERE id = ? AND role = 'customer'")
    .get(id) as { id: number; email: string; name: string; created_at: string } | undefined;
  if (!user) throw notFound('Customer');
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(id) as Parameters<typeof mapOrder>[0][];
  res.json({
    customer: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at },
    orders: orders.map((o) => mapOrder(o, { includeItems: true })),
  });
});

export default router;
