import { Link } from 'react-router-dom';
import type { Product } from '../lib/types';
import { formatPrice } from '../lib/format';
import { useCart } from '../context/CartContext';
import { Badge, Stars } from './ui';

export function ProductCard({ product }: { product: Product }) {
  const { addItem, busy } = useCart();

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-2xl border border-line/70 bg-panel transition duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_18px_50px_rgba(225,6,0,0.12)]"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon/40 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" aria-hidden />
        {product.badge && (
          <div className="absolute top-3 left-3">
            <Badge>{product.badge}</Badge>
          </div>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <div className="absolute top-3 right-3 rounded-full bg-carbon/80 px-2.5 py-1 text-[11px] font-semibold text-terracotta backdrop-blur">
            Only {product.stock} left
          </div>
        )}
        <button
          type="button"
          disabled={busy || product.stock === 0}
          onClick={(e) => {
            e.preventDefault();
            void addItem(product.id, 1).catch(() => {});
          }}
          className="absolute inset-x-3 bottom-3 translate-y-2 rounded-full bg-snow/95 py-2.5 text-sm font-bold tracking-wide text-carbon uppercase opacity-0 backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-accent disabled:opacity-50"
        >
          {product.stock === 0 ? 'Sold' : 'Add to garage'}
        </button>
      </div>
      <div className="p-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">{product.category?.name}</p>
        <h3 className="mt-1.5 text-sm leading-snug font-semibold">{product.name}</h3>
        <div className="mt-1.5">
          <Stars rating={product.rating} count={product.ratingCount} />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="font-display text-base text-snow">{formatPrice(product.priceCents)}</span>
          {product.compareAtCents && (
            <span className="text-sm text-muted line-through">
              {formatPrice(product.compareAtCents)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
