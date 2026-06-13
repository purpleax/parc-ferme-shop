// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { CartProvider } from '../context/CartContext';
import { ToastProvider } from '../context/ToastContext';
import { formatPrice } from '../lib/format';
import type { Product } from '../lib/types';

const product: Product = {
  id: 1,
  sku: 'PF-HE-001',
  slug: '1992-monza-podium-replica-helmet',
  name: '1992 Monza Podium Replica Helmet',
  description: 'Hand-signed replica helmet.',
  priceCents: 28900,
  compareAtCents: 31900,
  category: { slug: 'helmets', name: 'Helmets' },
  stock: 6,
  rating: 4.8,
  ratingCount: 214,
  badge: 'Signed',
  image: '/api/images/products/1992-monza-podium-replica-helmet.jpg',
  featured: true,
  active: true,
  createdAt: '2026-01-01 00:00:00',
};

describe('formatPrice', () => {
  it('formats cents as USD', () => {
    expect(formatPrice(28900)).toBe('$289.00');
    expect(formatPrice(125050)).toBe('$1,250.50');
  });
});

describe('ProductCard', () => {
  it('renders name, price, badge and sale price', () => {
    render(
      <ToastProvider>
        <CartProvider>
          <MemoryRouter>
            <ProductCard product={product} />
          </MemoryRouter>
        </CartProvider>
      </ToastProvider>
    );
    expect(screen.getByText('1992 Monza Podium Replica Helmet')).toBeTruthy();
    expect(screen.getByText('$289.00')).toBeTruthy();
    expect(screen.getByText('$319.00')).toBeTruthy();
    expect(screen.getByText('Signed')).toBeTruthy();
    expect(screen.getByRole('link')).toBeTruthy();
  });
});
