import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Product } from '../lib/types';
import { formatPrice } from '../lib/format';
import { useCart } from '../context/CartContext';
import { useDeviceVerification } from '../context/FastlyChallengeContext';
import { ProductCard } from '../components/ProductCard';
import { DeviceVerification } from '../components/DeviceVerification';
import { Badge, EmptyState, QtyStepper, Spinner, Stars } from '../components/ui';

export function ProductDetail() {
  const { slug } = useParams();
  const { addItem, busy } = useCart();
  const { verified } = useDeviceVerification();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    setState('loading');
    setQty(1);
    window.scrollTo(0, 0);
    api<{ product: Product; related: Product[] }>(`/products/${slug}`)
      .then((res) => {
        setProduct(res.product);
        setRelated(res.related);
        setState('ready');
      })
      .catch((err) => {
        setState(err instanceof ApiError && err.status === 404 ? 'missing' : 'missing');
      });
  }, [slug]);

  if (state === 'loading') {
    return (
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <div className="skeleton aspect-square rounded-3xl" />
        <div className="space-y-4 py-4">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-9 w-3/4 rounded" />
          <div className="skeleton h-5 w-32 rounded" />
          <div className="skeleton h-24 w-full rounded" />
          <div className="skeleton h-12 w-48 rounded-full" />
        </div>
      </div>
    );
  }

  if (state === 'missing' || !product) {
    return (
      <EmptyState
        title="Product not found"
        body="This piece may have sold out or been retired from the collection."
        action={
          <Link to="/shop" className="rounded-full bg-snow px-6 py-2.5 text-sm font-medium text-carbon transition hover:bg-accent">
            Back to shop
          </Link>
        }
      />
    );
  }

  const inStock = product.stock > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-accent">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/shop" className="hover:text-accent">Shop</Link>
        {product.category && (
          <>
            <span className="mx-2">/</span>
            <Link to={`/shop?category=${product.category.slug}`} className="hover:text-accent">
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative overflow-hidden rounded-3xl">
          <img src={product.image} alt={product.name} className="aspect-square w-full object-cover" />
          {product.badge && (
            <div className="absolute top-4 left-4">
              <Badge>{product.badge}</Badge>
            </div>
          )}
        </div>

        <div className="animate-fade-up">
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">
            {product.category?.name} · {product.sku}
          </p>
          <h1 className="font-display mt-2 text-3xl leading-tight md:text-4xl">{product.name}</h1>
          <div className="mt-3">
            <Stars rating={product.rating} count={product.ratingCount} />
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{formatPrice(product.priceCents)}</span>
            {product.compareAtCents && (
              <>
                <span className="text-lg text-muted line-through">{formatPrice(product.compareAtCents)}</span>
                <span className="rounded-full bg-terracotta/10 px-2 py-0.5 text-xs font-semibold text-terracotta">
                  Save {formatPrice(product.compareAtCents - product.priceCents)}
                </span>
              </>
            )}
          </div>

          <p className="mt-6 leading-relaxed text-muted">{product.description}</p>

          <div className="mt-6 flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${inStock ? 'bg-accent' : 'bg-terracotta'}`} />
            {inStock ? (
              <span>
                In stock
                {product.stock <= 8 && <span className="text-terracotta"> — only {product.stock} left</span>}
              </span>
            ) : (
              <span className="text-terracotta">Out of stock</span>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <QtyStepper qty={qty} onChange={setQty} max={Math.min(10, product.stock)} disabled={!inStock} />
            <button
              disabled={!inStock || busy || !verified}
              onClick={() => void addItem(product.id, qty).catch(() => {})}
              className="flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-50"
            >
              {busy && <Spinner className="h-4 w-4" />}
              {inStock ? 'Add to garage' : 'Out of stock'}
            </button>
          </div>
          <DeviceVerification className="mt-3" />

          <dl className="mt-10 divide-y divide-line/60 border-y border-line/60 text-sm">
            {[
              ['Shipping', 'Free insured shipping on orders over $250. Otherwise $8 flat, fully tracked.'],
              ['Returns', '14-day returns on unsigned items. Race-worn and signed pieces are final sale.'],
              ['Provenance', 'Every piece ships with its certificate of authenticity and team paperwork.'],
            ].map(([title, body]) => (
              <div key={title} className="grid grid-cols-3 gap-4 py-4">
                <dt className="font-medium">{title}</dt>
                <dd className="col-span-2 text-muted">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display mb-6 text-2xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
