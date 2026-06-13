import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ORDER_STATUS_LABELS } from '../lib/format';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  const text = String(children);
  const tone =
    text === 'Race-worn' ? 'bg-accent text-white' :
    text === 'Signed' ? 'bg-gold text-carbon' :
    text === 'Limited' ? 'bg-snow text-carbon' :
    text === 'Sale' ? 'bg-terracotta text-carbon' : 'bg-graphite text-snow border border-line';
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${tone}`}>
      {text}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    pending_payment: 'bg-graphite text-muted border-line',
    paid: 'bg-accent/10 text-accent border-accent/20',
    shipped: 'bg-gold/15 text-gold border-gold/30',
    delivered: 'bg-accent text-carbon border-accent',
    cancelled: 'bg-terracotta/10 text-terracotta border-terracotta/20',
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone[status] ?? 'bg-graphite'}`}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-gold" aria-label={`${rating} out of 5 stars`}>
        {'★'.repeat(Math.round(rating))}
        <span className="text-line">{'★'.repeat(5 - Math.round(rating))}</span>
      </span>
      {count !== undefined && <span className="text-muted text-xs">({count})</span>}
    </span>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Field({ label, error, id, className = '', ...rest }: FieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-snow">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-lg border bg-panel px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-accent/30 ${
          error ? 'border-terracotta' : 'border-line focus:border-accent'
        }`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-terracotta">{error}</p>}
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

export function SelectField({ label, id, children, className = '', ...rest }: SelectFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-snow">
        {label}
      </label>
      <select
        id={inputId}
        className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-fade-up mx-auto max-w-md py-20 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-graphite text-2xl">
        ◌
      </div>
      <h2 className="font-display text-2xl text-snow">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-terracotta/10 text-2xl text-terracotta">
        !
      </div>
      <h2 className="font-display text-2xl">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 rounded-full bg-snow px-6 py-2.5 text-sm font-medium text-carbon transition hover:bg-accent"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-panel shadow-sm">
      <div className="skeleton aspect-square" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/4 rounded" />
      </div>
    </div>
  );
}

export function QtyStepper({
  qty,
  onChange,
  disabled,
  max = 10,
}: {
  qty: number;
  onChange: (qty: number) => void;
  disabled?: boolean;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-panel">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || qty <= 1}
        onClick={() => onChange(qty - 1)}
        className="px-3 py-1.5 text-lg leading-none text-muted transition hover:text-snow disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-8 text-center text-sm font-medium">{qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || qty >= max}
        onClick={() => onChange(qty + 1)}
        className="px-3 py-1.5 text-lg leading-none text-muted transition hover:text-snow disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-up relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-graphite"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
