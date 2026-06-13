import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Order } from '../lib/types';
import { formatDate, formatPrice } from '../lib/format';
import { EmptyState, ErrorState, Spinner, StatusBadge } from '../components/ui';

export function AccountOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api<{ orders: Order[] }>('/orders')
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err.message ?? 'Could not load orders'));
  };

  useEffect(load, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (orders === null) {
    return (
      <div className="flex justify-center py-32 text-accent">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        body="When you place an order it will show up here."
        action={
          <Link to="/shop" className="rounded-full bg-snow px-6 py-2.5 text-sm font-medium text-carbon transition hover:bg-accent">
            Start shopping
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display mb-8 text-3xl">Your orders</h1>
      <div className="space-y-5">
        {orders.map((order) => (
          <div key={order.id} className="overflow-hidden rounded-2xl bg-panel shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite/80 px-5 py-4">
              <div>
                <p className="font-semibold">{order.id}</p>
                <p className="text-xs text-muted">Placed {formatDate(order.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={order.status} />
                <span className="font-semibold">{formatPrice(order.totalCents)}</span>
              </div>
            </div>
            <ul className="divide-y divide-graphite/60">
              {order.items?.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                  {item.image && <img src={item.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                  <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                  <span className="text-sm text-muted">×{item.qty}</span>
                  <span className="text-sm font-medium">{formatPrice(item.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
