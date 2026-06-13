import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDeviceVerification } from '../context/FastlyChallengeContext';
import { ApiError } from '../lib/api';
import { DeviceVerification } from '../components/DeviceVerification';
import { Field, Spinner } from '../components/ui';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="animate-fade-up rounded-3xl bg-panel p-8 shadow-sm">
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function detailErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && Array.isArray(err.details)) {
    return Object.fromEntries(err.details.map((d) => [d.field ?? '', d.message]));
  }
  return {};
}

export function Login() {
  const { login } = useAuth();
  const { verified } = useDeviceVerification();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' && next === '/' ? '/admin' : next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Parc Fermé account.">
      <div className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-muted">
        <span className="font-semibold text-snow">Demo accounts</span><br />
        Customer: ava@demo.dev / Customer123!<br />
        Admin: admin@parcferme.dev / Admin123!
      </div>
      {error && (
        <div role="alert" className="animate-fade-up mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button
          disabled={busy || !verified}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />}
          Sign in
        </button>
        <DeviceVerification className="w-full justify-center" />
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New here?{' '}
        <Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useAuth();
  const { verified } = useDeviceVerification();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    setBusy(true);
    try {
      await register(name, email, password);
      navigate(next);
    } catch (err) {
      setErrors(detailErrors(err));
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="A minute now, pole position on every drop.">
      {error && (
        <div role="alert" className="animate-fade-up mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Field label="Full name" value={name} error={errors['name']} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Field label="Email" type="email" value={email} error={errors['email']} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Field
          label="Password"
          type="password"
          value={password}
          error={errors['password']}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="8+ characters, a letter and a number"
        />
        <button
          disabled={busy || !verified}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />}
          Create account
        </button>
        <DeviceVerification className="w-full justify-center" />
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
