import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Order } from '../lib/types';
import { formatPrice } from '../lib/format';
import { ErrorState, Spinner } from '../components/ui';

export function OrderConfirmation() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ order: Order }>(`/orders/${id}`)
      .then((res) => setOrder(res.order))
      .catch((err) => setError(err.message ?? 'Could not load the order'));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!order) {
    return (
      <div className="flex justify-center py-32 text-accent">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="animate-fade-up text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl text-carbon">
          ✓
        </div>
        <h1 className="font-display mt-5 text-3xl">Thank you for your order</h1>
        <p className="mt-2 text-muted">
          Order <span className="font-semibold text-snow">{order.id}</span> is confirmed.
          A receipt is on its way to your inbox.
        </p>
      </div>

      <div className="animate-fade-up mt-10 overflow-hidden rounded-2xl bg-panel shadow-sm" style={{ animationDelay: '120ms' }}>
        <ul className="divide-y divide-graphite/80">
          {order.items?.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-4">
              {item.image && <img src={item.image} alt="" className="h-14 w-14 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-sm text-muted">Qty {item.qty}</p>
              </div>
              <span className="font-medium">{formatPrice(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 bg-graphite/40 p-5 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatPrice(order.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{order.shippingCents === 0 ? 'Free' : formatPrice(order.shippingCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{formatPrice(order.taxCents)}</dd></div>
          <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatPrice(order.totalCents)}</dd></div>
          {order.payment?.cardLast4 && (
            <p className="pt-2 text-xs text-muted">
              Paid with {order.payment.cardBrand} ending in {order.payment.cardLast4}
            </p>
          )}
        </dl>
      </div>

      <div className="animate-fade-up mt-6 rounded-2xl border border-line/60 p-5 text-sm" style={{ animationDelay: '200ms' }}>
        <p className="font-medium">Shipping to</p>
        <p className="mt-1 leading-relaxed text-muted">
          {order.shipping.name}<br />
          {order.shipping.line1}{order.shipping.line2 ? <><br />{order.shipping.line2}</> : null}<br />
          {order.shipping.city}, {order.shipping.postalCode}<br />
          {order.shipping.country}
        </p>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link to="/account/orders" className="rounded-full bg-snow px-6 py-2.5 text-sm font-medium text-carbon transition hover:bg-accent">
          View my orders
        </Link>
        <Link to="/shop" className="rounded-full border border-line px-6 py-2.5 text-sm font-medium transition hover:border-accent hover:text-accent">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
