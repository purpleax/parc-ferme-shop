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
      <p className="mt-4 text-center text-sm text-muted">
        <Link to="/forgot-password" className="font-medium text-accent hover:underline">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted">
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

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // Deliberately ignore errors: the endpoint always succeeds for a valid
      // email, and we never reveal whether an account exists.
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to set a new one.">
      {sent ? (
        <div role="status" className="animate-fade-up mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-4 text-sm leading-relaxed text-muted">
          <span className="font-semibold text-snow">Password reset link emailed.</span>
          <br />
          If an account exists for <span className="text-snow">{email}</span>, a link to reset your
          password is on its way. Check your inbox and spam folder.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />}
            Email me a reset link
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-muted">
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
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
      await resetPassword(token, password);
      navigate('/login');
    } catch (err) {
      setErrors(detailErrors(err));
      setError(err instanceof ApiError ? err.message : 'Could not reset your password');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Reset your password" subtitle="Something's missing.">
        <div role="alert" className="animate-fade-up mt-5 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          This reset link is missing its token. Request a new link to continue.
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          <Link to="/forgot-password" className="font-medium text-accent hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Almost there — pick something strong.">
      {error && (
        <div role="alert" className="animate-fade-up mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Field
          label="New password"
          type="password"
          value={password}
          error={errors['password']}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="8+ characters, a letter and a number"
        />
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />}
          Reset password
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        <Link to="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
