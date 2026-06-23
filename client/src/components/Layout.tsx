import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api, ApiError } from '../lib/api';
import { useToast } from '../context/ToastContext';

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display tracking-tight uppercase ${className}`}>
      Parc<span className="text-accent">/</span>Fermé
    </span>
  );
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        navigate(`/shop?search=${encodeURIComponent(value.trim())}`);
        setValue('');
        onDone?.();
      }}
    >
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search the vault…"
        aria-label="Search products"
        className="w-full rounded-full border border-line bg-graphite/70 px-4 py-2 text-sm text-snow outline-none transition placeholder:text-muted/70 focus:border-accent focus:bg-graphite focus:ring-2 focus:ring-accent/25 md:w-52 md:focus:w-64"
      />
    </form>
  );
}

function Navbar() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const itemCount = cart?.itemCount ?? 0;

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition hover:text-snow ${isActive ? 'font-semibold text-accent' : 'text-muted'}`;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-carbon/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-8">
          <Link to="/" aria-label="Parc Fermé home">
            <Wordmark className="text-lg whitespace-nowrap" />
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            <NavLink to="/shop" className={navLink}>
              The vault
            </NavLink>
            <NavLink to="/shop?sort=newest" className={() => 'text-sm text-muted transition hover:text-snow'}>
              New arrivals
            </NavLink>
            <NavLink to="/information" className={navLink}>
              F1 history
            </NavLink>
            <NavLink to="/about" className={navLink}>
              About
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navLink}>
                Admin
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <SearchBox />
          </div>

          {user ? (
            <div className="hidden items-center gap-3 md:flex">
              <Link to="/account/orders" className="text-sm text-muted transition hover:text-snow">
                {user.name.split(' ')[0]}
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="text-sm text-muted transition hover:text-accent"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login" className="hidden text-sm text-muted transition hover:text-snow md:block">
              Sign in
            </Link>
          )}

          <Link
            to="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-snow text-carbon transition hover:bg-accent"
            aria-label={`Shopping bag, ${itemCount} items`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 7h12l1 14H5L6 7z" />
              <path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-graphite md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="animate-fade-up border-t border-line/70 px-4 py-4 md:hidden" aria-label="Mobile">
          <SearchBox onDone={() => setMenuOpen(false)} />
          <div className="mt-4 flex flex-col gap-3">
            <Link to="/shop" onClick={() => setMenuOpen(false)} className="text-sm font-medium">
              The vault
            </Link>
            <Link to="/information" onClick={() => setMenuOpen(false)} className="text-sm">
              F1 history
            </Link>
            <Link to="/about" onClick={() => setMenuOpen(false)} className="text-sm">
              About
            </Link>
            {user ? (
              <>
                <Link to="/account/orders" onClick={() => setMenuOpen(false)} className="text-sm">
                  My orders
                </Link>
                {user.role === 'admin' && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)} className="text-sm">
                    Admin dashboard
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                    navigate('/');
                  }}
                  className="text-left text-sm text-accent"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="text-sm">
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/newsletter', { method: 'POST', body: { email } });
      toast('You’re on the pit wall.');
      setEmail('');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Subscription failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        aria-label="Email address"
        className="w-full rounded-full border border-line bg-graphite px-4 py-2.5 text-sm text-snow outline-none placeholder:text-muted/70 focus:border-accent"
      />
      <button
        disabled={busy}
        className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-carbon uppercase transition hover:bg-accent-light disabled:opacity-60"
      >
        {busy ? '…' : 'Join'}
      </button>
    </form>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-line/70 bg-graphite/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Wordmark className="text-lg" />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Authenticated Formula 1 memorabilia. A fictional storefront built for API security
            demonstrations — no real products, payments or personal data.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Explore</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="transition hover:text-accent" to="/shop">The vault</Link></li>
            <li><Link className="transition hover:text-accent" to="/shop?sort=newest">New arrivals</Link></li>
            <li><Link className="transition hover:text-accent" to="/information">F1 history</Link></li>
            <li><Link className="transition hover:text-accent" to="/about">About</Link></li>
            <li><Link className="transition hover:text-accent" to="/account/orders">My orders</Link></li>
            <li><a className="transition hover:text-accent" href="/api/docs" target="_blank" rel="noreferrer">API docs</a></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Pit wall briefing</p>
          <p className="mt-3 mb-3 text-sm text-muted">New acquisitions, before the grid hears about them.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-line/70 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} Parc Fermé — demo environment only · photography via Wikimedia Commons (see sources.json)
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
