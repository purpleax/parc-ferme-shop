import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminStats } from '../../lib/types';
import { formatDate, formatPrice } from '../../lib/format';
import { ErrorState, StatusBadge } from '../../components/ui';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-panel p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">{label}</p>
      <p className="font-display mt-2 text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api<{ stats: AdminStats }>('/admin/stats')
      .then((res) => setStats(res.stats))
      .catch((err) => setError(err.message));
  };
  useEffect(load, []);

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Storefront performance at a glance.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Revenue" value={formatPrice(stats.revenueCents)} hint="Paid, shipped & delivered orders" />
            <StatCard label="Orders" value={String(stats.orderCount)} />
            <StatCard label="Customers" value={String(stats.customerCount)} />
            <StatCard label="Active products" value={String(stats.productCount)} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-panel p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-medium text-accent hover:underline">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line/60 text-xs tracking-wide text-muted uppercase">
                  <th className="pb-2 pr-4 font-medium">Order</th>
                  <th className="pb-2 pr-4 font-medium">Customer</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite/80">
                {(stats?.recentOrders ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 pr-4 font-medium">{o.id}</td>
                    <td className="py-3 pr-4">{o.customerName}</td>
                    <td className="py-3 pr-4 text-muted">{formatDate(o.createdAt)}</td>
                    <td className="py-3 pr-4"><StatusBadge status={o.status} /></td>
                    <td className="py-3 text-right font-medium">{formatPrice(o.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-panel p-5 shadow-sm">
            <h2 className="font-display mb-4 text-lg">Top products</h2>
            <ul className="space-y-3">
              {(stats?.topProducts ?? []).map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-graphite text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted">{p.units} sold</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-panel p-5 shadow-sm">
            <h2 className="font-display mb-4 text-lg">Low stock</h2>
            {stats && stats.lowStock.length === 0 ? (
              <p className="text-sm text-muted">All products well stocked.</p>
            ) : (
              <ul className="space-y-3">
                {(stats?.lowStock ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${p.stock <= 5 ? 'bg-terracotta/10 text-terracotta' : 'bg-gold/15 text-[#8a6a1f]'}`}>
                      {p.stock} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
