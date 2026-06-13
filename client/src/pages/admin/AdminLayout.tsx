import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui';

const links = [
  ['/admin', 'Dashboard', 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'],
  ['/admin/products', 'Products', 'M20 7l-8-4-8 4v10l8 4 8-4V7zM12 12l8-4M12 12L4 8m8 4v9'],
  ['/admin/orders', 'Orders', 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2'],
  ['/admin/customers', 'Customers', 'M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2H9zm3-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 0a3 3 0 1 0 0-6'],
] as const;

export function AdminLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-accent">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen bg-graphite/40">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line/60 bg-carbon md:flex">
        <div className="border-b border-line/60 px-5 py-5">
          <Link to="/" className="font-display text-lg">
            Parc<span className="text-accent">/</span>Fermé
          </Link>
          <p className="mt-0.5 text-[11px] font-semibold tracking-widest text-muted uppercase">Back office</p>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Admin">
          {links.map(([to, label, d]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-accent text-carbon' : 'text-muted hover:bg-graphite'
                }`
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={d} />
              </svg>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line/60 p-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <Link to="/" className="text-xs text-muted transition hover:text-accent">
            ← Back to store
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-line/60 bg-carbon px-4 py-3 md:hidden">
          <Link to="/" className="font-display uppercase">Parc<span className="text-accent">/</span>Fermé</Link>
          <nav className="flex gap-4 text-sm" aria-label="Admin mobile">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin'}
                className={({ isActive }) => (isActive ? 'font-semibold text-accent' : 'text-muted')}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <main className="p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
