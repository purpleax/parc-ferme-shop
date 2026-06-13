import fs from 'node:fs';
import { config } from '../config.js';

export interface ProductRow {
  id: number;
  sku: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  compare_at_cents: number | null;
  category_id: number;
  category_slug?: string;
  category_name?: string;
  stock: number;
  rating: number;
  rating_count: number;
  badge: string | null;
  image_seed: string;
  featured: number;
  active: number;
  created_at: string;
}

// Photos live in server/public/products/<seed>.jpg (fetched by scripts/fetch-images.mjs).
// Products without a photo fall back to the generated SVG artwork.
let photoCache: Set<string> | null = null;
let photoCacheTime = 0;

function hasPhoto(seed: string): boolean {
  if (!photoCache || Date.now() - photoCacheTime > 10_000) {
    try {
      photoCache = new Set(
        fs.readdirSync(config.photosDir)
          .filter((f) => f.endsWith('.jpg'))
          .map((f) => f.slice(0, -4))
      );
    } catch {
      photoCache = new Set();
    }
    photoCacheTime = Date.now();
  }
  return photoCache.has(seed);
}

export function imageUrl(seed: string): string {
  return hasPhoto(seed)
    ? `/api/images/products/${seed}.jpg`
    : `/api/images/products/${seed}.svg`;
}

export function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    compareAtCents: row.compare_at_cents,
    category: row.category_slug
      ? { slug: row.category_slug, name: row.category_name }
      : undefined,
    stock: row.stock,
    rating: row.rating,
    ratingCount: row.rating_count,
    badge: row.badge,
    image: imageUrl(row.image_seed),
    featured: row.featured === 1,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

export const PRODUCT_SELECT = `
  SELECT p.*, c.slug AS category_slug, c.name AS category_name
  FROM products p JOIN categories c ON c.id = p.category_id
`;

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function orderId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `PF-${suffix}`;
}
