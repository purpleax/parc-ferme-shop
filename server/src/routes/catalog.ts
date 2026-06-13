import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { notFound } from '../errors.js';
import { parse } from '../middleware.js';
import { imageUrl, mapProduct, PRODUCT_SELECT, type ProductRow } from './helpers.js';

const router = Router();

router.get('/categories', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT c.id, c.slug, c.name, c.description, c.image_seed,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
      FROM categories c ORDER BY c.name
    `)
    .all() as {
      id: number; slug: string; name: string; description: string; image_seed: string; product_count: number;
    }[];
  res.json({
    categories: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      image: imageUrl(c.image_seed),
      productCount: c.product_count,
    })),
  });
});

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
  minPrice: z.coerce.number().min(0).max(100000).optional(),
  maxPrice: z.coerce.number().min(0).max(100000).optional(),
  sort: z.enum(['featured', 'price_asc', 'price_desc', 'newest', 'rating']).default('featured'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

router.get('/products', (req, res) => {
  const q = parse(listSchema, req.query);
  const where: string[] = ['p.active = 1'];
  const params: Record<string, unknown> = {};

  if (q.search) {
    where.push('(p.name LIKE :search OR p.description LIKE :search OR p.sku LIKE :search)');
    params.search = `%${q.search}%`;
  }
  if (q.category) {
    where.push('c.slug = :category');
    params.category = q.category;
  }
  if (q.minPrice !== undefined) {
    where.push('p.price_cents >= :minPrice');
    params.minPrice = Math.round(q.minPrice * 100);
  }
  if (q.maxPrice !== undefined) {
    where.push('p.price_cents <= :maxPrice');
    params.maxPrice = Math.round(q.maxPrice * 100);
  }

  const orderBy = {
    featured: 'p.featured DESC, p.rating_count DESC',
    price_asc: 'p.price_cents ASC',
    price_desc: 'p.price_cents DESC',
    newest: 'p.created_at DESC',
    rating: 'p.rating DESC, p.rating_count DESC',
  }[q.sort];

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}`)
      .get(params) as { n: number }
  ).n;
  const rows = db
    .prepare(`${PRODUCT_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT :limit OFFSET :offset`)
    .all({ ...params, limit: q.pageSize, offset: (q.page - 1) * q.pageSize }) as ProductRow[];

  res.json({
    items: rows.map(mapProduct),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  });
});

router.get('/products/featured', (_req, res) => {
  const rows = db
    .prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.featured = 1 ORDER BY p.rating_count DESC LIMIT 8`)
    .all() as ProductRow[];
  res.json({ items: rows.map(mapProduct) });
});

router.get('/products/:slug', (req, res) => {
  const slug = parse(z.string().min(1).max(120), req.params.slug);
  const row = db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.active = 1`).get(slug) as
    | ProductRow
    | undefined;
  if (!row) throw notFound('Product');
  const related = db
    .prepare(
      `${PRODUCT_SELECT} WHERE p.category_id = ? AND p.id != ? AND p.active = 1 ORDER BY p.rating_count DESC LIMIT 4`
    )
    .all(row.category_id, row.id) as ProductRow[];
  res.json({ product: mapProduct(row), related: related.map(mapProduct) });
});

export default router;
