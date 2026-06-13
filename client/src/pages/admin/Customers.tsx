import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AdminCustomer } from '../../lib/types';
import { formatDate, formatPrice } from '../../lib/format';
import { ErrorState, Spinner } from '../../components/ui';

export function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api<{ customers: AdminCustomer[] }>('/admin/customers')
      .then((res) => setCustomers(res.customers))
      .catch((err) => setError(err.message));
  };
  useEffect(load, []);

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl">Customers</h1>
      <p className="mt-1 text-sm text-muted">{customers?.length ?? '…'} registered customers.</p>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-panel shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line/60 text-xs tracking-wide text-muted uppercase">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 text-right font-medium">Lifetime spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite/70">
            {customers === null ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <Spinner className="mx-auto h-6 w-6 text-accent" />
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                        {c.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">{c.orderCount}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatPrice(c.totalSpentCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
