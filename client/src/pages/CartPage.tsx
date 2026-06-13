import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';
import { EmptyState, QtyStepper } from '../components/ui';

const FREE_SHIPPING_CENTS = 25000;

export function CartPage() {
  const { cart, busy, updateItem, removeItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Your garage is empty"
        body="Browse the vault and find something that crossed the line first."
        action={
          <Link to="/shop" className="rounded-full bg-snow px-6 py-2.5 text-sm font-medium text-carbon transition hover:bg-accent">
            Start shopping
          </Link>
        }
      />
    );
  }

  const remaining = FREE_SHIPPING_CENTS - cart.subtotalCents;
  const progress = Math.min(100, (cart.subtotalCents / FREE_SHIPPING_CENTS) * 100);

  const checkout = () => {
    if (!user) navigate('/login?next=/checkout');
    else navigate('/checkout');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display mb-8 text-3xl uppercase">Your garage</h1>
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {cart.items.map((item) => (
            <div key={item.id} className="flex gap-4 rounded-2xl bg-panel p-4 shadow-sm">
              <Link to={`/product/${item.slug}`} className="shrink-0">
                <img src={item.image} alt={item.name} className="h-24 w-24 rounded-xl object-cover" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/product/${item.slug}`} className="font-display leading-snug hover:text-accent">
                    {item.name}
                  </Link>
                  <button
                    onClick={() => void removeItem(item.id)}
                    disabled={busy}
                    aria-label={`Remove ${item.name}`}
                    className="text-sm text-muted transition hover:text-terracotta"
                  >
                    Remove
                  </button>
                </div>
                <p className="mt-0.5 text-sm text-muted">{formatPrice(item.priceCents)} each</p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QtyStepper
                    qty={item.qty}
                    onChange={(q) => void updateItem(item.id, q)}
                    disabled={busy}
                    max={Math.min(10, item.stock)}
                  />
                  <span className="font-semibold">{formatPrice(item.lineTotalCents)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="sticky top-24 rounded-2xl bg-panel p-6 shadow-sm">
            <h2 className="font-display text-lg">Summary</h2>

            <div className="mt-5">
              {remaining > 0 ? (
                <p className="text-sm text-muted">
                  <span className="font-medium text-snow">{formatPrice(remaining)}</span> away from free shipping
                </p>
              ) : (
                <p className="text-sm font-medium text-accent">You've unlocked free shipping ✓</p>
              )}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-graphite">
                <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <dl className="mt-6 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal ({cart.itemCount} items)</dt>
                <dd className="font-medium">{formatPrice(cart.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="font-medium">{remaining > 0 ? formatPrice(800) : 'Free'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Estimated tax (8%)</dt>
                <dd className="font-medium">{formatPrice(Math.round(cart.subtotalCents * 0.08))}</dd>
              </div>
              <div className="flex justify-between border-t border-line/60 pt-3 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-semibold">
                  {formatPrice(cart.subtotalCents + (remaining > 0 ? 800 : 0) + Math.round(cart.subtotalCents * 0.08))}
                </dd>
              </div>
            </dl>

            <button
              onClick={checkout}
              disabled={busy}
              className="mt-6 w-full rounded-full bg-accent py-3.5 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-60"
            >
              {user ? 'Checkout' : 'Sign in to checkout'}
            </button>
            <Link to="/shop" className="mt-3 block text-center text-sm text-muted hover:text-accent">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
