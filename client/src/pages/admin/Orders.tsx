import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { Order, OrderStatus } from '../../lib/types';
import { ORDER_STATUS_LABELS, formatDate, formatPrice } from '../../lib/format';
import { ErrorState, Modal, Spinner, StatusBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

const STATUSES: (OrderStatus | 'all')[] = ['all', 'pending_payment', 'paid', 'shipped', 'delivered', 'cancelled'];

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = (status: OrderStatus | 'all' = filter) => {
    setError(null);
    setOrders(null);
    api<{ orders: Order[] }>(`/admin/orders${status !== 'all' ? `?status=${status}` : ''}`)
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err.message));
  };
  useEffect(() => load(filter), [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id: string) => {
    try {
      const res = await api<{ order: Order }>(`/admin/orders/${id}`);
      setSelected(res.order);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not load order', 'error');
    }
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    setBusy(true);
    try {
      const res = await api<{ order: Order }>(`/admin/orders/${id}`, { method: 'PATCH', body: { status } });
      setSelected((prev) => (prev ? { ...prev, status: res.order.status } : prev));
      toast(`Order marked ${ORDER_STATUS_LABELS[status].toLowerCase()}`);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => load()} />;

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl">Orders</h1>
      <p className="mt-1 text-sm text-muted">Review and progress customer orders.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === s ? 'bg-accent text-carbon' : 'bg-panel text-muted shadow-sm hover:text-snow'
            }`}
          >
            {s === 'all' ? 'All' : ORDER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl bg-panel shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line/60 text-xs tracking-wide text-muted uppercase">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite/70">
            {orders === null ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Spinner className="mx-auto h-6 w-6 text-accent" />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  No orders with this status.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => void openDetail(o.id)}
                  className="cursor-pointer transition hover:bg-graphite/40"
                >
                  <td className="px-4 py-3 font-medium">{o.id}</td>
                  <td className="px-4 py-3">
                    <p>{o.customer?.name}</p>
                    <p className="text-xs text-muted">{o.customer?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-right font-medium">{formatPrice(o.totalCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal title={`Order ${selected.id}`} onClose={() => setSelected(null)}>
          <div className="flex items-center justify-between">
            <StatusBadge status={selected.status} />
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Set status:</span>
              <select
                value={selected.status}
                disabled={busy}
                onChange={(e) => void updateStatus(selected.id, e.target.value as OrderStatus)}
                className="rounded-lg border border-line bg-panel px-2 py-1.5 text-sm outline-none focus:border-accent"
              >
                {STATUSES.filter((s) => s !== 'all').map((s) => (
                  <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl bg-graphite/50 p-4 text-sm">
            <p className="font-medium">{selected.customer?.name} · {selected.customer?.email}</p>
            <p className="mt-1 text-muted">
              {selected.shipping.name}, {selected.shipping.line1}, {selected.shipping.city}{' '}
              {selected.shipping.postalCode}, {selected.shipping.country}
            </p>
          </div>

          <ul className="mt-4 divide-y divide-graphite/70">
            {selected.items?.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                {item.image && <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-muted">×{item.qty}</span>
                <span className="font-medium">{formatPrice(item.lineTotalCents)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-1.5 border-t border-line/60 pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatPrice(selected.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{selected.shippingCents === 0 ? 'Free' : formatPrice(selected.shippingCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{formatPrice(selected.taxCents)}</dd></div>
            <div className="flex justify-between pt-1 font-semibold"><dt>Total</dt><dd>{formatPrice(selected.totalCents)}</dd></div>
          </dl>
        </Modal>
      )}
    </div>
  );
}
