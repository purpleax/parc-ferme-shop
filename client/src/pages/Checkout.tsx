import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import type { Order } from '../lib/types';
import { formatPrice } from '../lib/format';
import { useCart } from '../context/CartContext';
import { EmptyState, Field, Spinner } from '../components/ui';

type Step = 'shipping' | 'payment';

interface ShippingForm {
  name: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
}

interface CardForm {
  number: string;
  expiry: string; // MM/YY
  cvc: string;
  name: string;
}

function fieldErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && Array.isArray(err.details)) {
    return Object.fromEntries(err.details.map((d) => [d.field ?? '', d.message]));
  }
  return {};
}

export function Checkout() {
  const { cart, refresh } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('shipping');
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [shipping, setShipping] = useState<ShippingForm>({
    name: '', line1: '', line2: '', city: '', postalCode: '', country: 'United States',
  });
  const [card, setCard] = useState<CardForm>({ number: '', expiry: '', cvc: '', name: '' });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const totals = useMemo(() => {
    if (order) {
      return {
        subtotal: order.subtotalCents,
        shipping: order.shippingCents,
        tax: order.taxCents,
        total: order.totalCents,
        count: order.items?.reduce((s, i) => s + i.qty, 0) ?? 0,
      };
    }
    const subtotal = cart?.subtotalCents ?? 0;
    const ship = subtotal >= 25000 ? 0 : 800;
    const tax = Math.round(subtotal * 0.08);
    return { subtotal, shipping: ship, tax, total: subtotal + ship + tax, count: cart?.itemCount ?? 0 };
  }, [cart, order]);

  if (!order && (!cart || cart.items.length === 0)) {
    return (
      <EmptyState
        title="Nothing to check out"
        body="Your garage is empty — add something first."
        action={
          <Link to="/shop" className="rounded-full bg-snow px-6 py-2.5 text-sm font-medium text-carbon transition hover:bg-accent">
            Back to shop
          </Link>
        }
      />
    );
  }

  const validateShipping = (): boolean => {
    const next: Record<string, string> = {};
    if (shipping.name.trim().length < 2) next['shipping.name'] = 'Enter the recipient name';
    if (shipping.line1.trim().length < 3) next['shipping.line1'] = 'Enter a street address';
    if (shipping.city.trim().length < 2) next['shipping.city'] = 'Enter a city';
    if (shipping.postalCode.trim().length < 3) next['shipping.postalCode'] = 'Enter a postal code';
    if (shipping.country.trim().length < 2) next['shipping.country'] = 'Enter a country';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitShipping = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validateShipping() || !cart) return;
    setBusy(true);
    try {
      const res = await api<{ order: Order }>('/orders', {
        method: 'POST',
        body: {
          cartId: cart.id,
          shipping: {
            name: shipping.name,
            line1: shipping.line1,
            line2: shipping.line2 || undefined,
            city: shipping.city,
            postalCode: shipping.postalCode,
            country: shipping.country,
          },
        },
      });
      setOrder(res.order);
      setStep('payment');
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(err instanceof ApiError ? err.message : 'Could not create the order');
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setFormError(null);
    setErrors({});

    const [mm, yy] = card.expiry.split('/').map((s) => s.trim());
    const expMonth = Number(mm);
    const expYear = 2000 + Number(yy);
    const next: Record<string, string> = {};
    if (card.number.replace(/\s/g, '').length < 13) next['card.number'] = 'Enter a card number';
    if (!mm || !yy || Number.isNaN(expMonth) || Number.isNaN(Number(yy))) next['card.expiry'] = 'Use MM/YY';
    if (!/^\d{3,4}$/.test(card.cvc)) next['card.cvc'] = '3–4 digits';
    if (card.name.trim().length < 2) next['card.name'] = 'Name on card';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setBusy(true);
    try {
      const intent = await api<{ payment: { id: string } }>('/payments/intent', {
        method: 'POST',
        body: { orderId: order.id },
      });
      await api(`/payments/${intent.payment.id}/confirm`, {
        method: 'POST',
        body: {
          card: {
            number: card.number.replace(/\s/g, ''),
            expMonth,
            expYear,
            cvc: card.cvc,
            name: card.name,
          },
        },
      });
      await refresh(); // cart was emptied server-side
      navigate(`/order/${order.id}/confirmation`);
    } catch (err) {
      const fe = fieldErrors(err);
      // map server card field names onto local form
      if (fe['card.expYear'] || fe['card.expMonth']) fe['card.expiry'] = fe['card.expYear'] ?? fe['card.expMonth'];
      setErrors(fe);
      setFormError(err instanceof ApiError ? err.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  const formatCardNumber = (raw: string) =>
    raw.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

  const formatExpiry = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display mb-2 text-3xl">Checkout</h1>
      <ol className="mb-8 flex items-center gap-3 text-sm" aria-label="Checkout steps">
        {(['shipping', 'payment'] as const).map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            {i > 0 && <span className="text-line">—</span>}
            <span
              className={`flex items-center gap-2 ${step === s ? 'font-semibold text-accent' : 'text-muted'}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  step === s ? 'bg-accent text-carbon' : order && s === 'shipping' ? 'bg-accent/20 text-accent' : 'bg-graphite'
                }`}
              >
                {order && s === 'shipping' ? '✓' : i + 1}
              </span>
              {s === 'shipping' ? 'Shipping' : 'Payment'}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {formError && (
            <div role="alert" className="animate-fade-up mb-5 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
              {formError}
            </div>
          )}

          {step === 'shipping' ? (
            <form onSubmit={submitShipping} className="animate-fade-up space-y-4 rounded-2xl bg-panel p-6 shadow-sm" noValidate>
              <h2 className="font-display text-lg">Shipping address</h2>
              <Field label="Full name" value={shipping.name} error={errors['shipping.name']}
                onChange={(e) => setShipping({ ...shipping, name: e.target.value })} autoComplete="name" />
              <Field label="Address line 1" value={shipping.line1} error={errors['shipping.line1']}
                onChange={(e) => setShipping({ ...shipping, line1: e.target.value })} autoComplete="address-line1" />
              <Field label="Address line 2 (optional)" value={shipping.line2}
                onChange={(e) => setShipping({ ...shipping, line2: e.target.value })} autoComplete="address-line2" />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City" value={shipping.city} error={errors['shipping.city']}
                  onChange={(e) => setShipping({ ...shipping, city: e.target.value })} autoComplete="address-level2" />
                <Field label="Postal code" value={shipping.postalCode} error={errors['shipping.postalCode']}
                  onChange={(e) => setShipping({ ...shipping, postalCode: e.target.value })} autoComplete="postal-code" />
                <Field label="Country" value={shipping.country} error={errors['shipping.country']}
                  onChange={(e) => setShipping({ ...shipping, country: e.target.value })} autoComplete="country-name" />
              </div>
              <button
                disabled={busy}
                className="mt-2 flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-60"
              >
                {busy && <Spinner className="h-4 w-4" />}
                Continue to payment
              </button>
            </form>
          ) : (
            <form onSubmit={submitPayment} className="animate-fade-up space-y-4 rounded-2xl bg-panel p-6 shadow-sm" noValidate>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg">Payment</h2>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 1 1 6 0v3H9z"/></svg>
                  Mock payment — no real charges
                </span>
              </div>

              <div className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-muted">
                <span className="font-semibold text-snow">Test cards:</span> 4242 4242 4242 4242 succeeds ·
                4000 0000 0000 0002 declines · 4000 0000 0000 9995 insufficient funds.
                Any future expiry and any CVC.
              </div>

              <Field
                label="Card number"
                inputMode="numeric"
                placeholder="4242 4242 4242 4242"
                value={card.number}
                error={errors['card.number']}
                onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                autoComplete="cc-number"
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Expiry (MM/YY)"
                  inputMode="numeric"
                  placeholder="12/30"
                  value={card.expiry}
                  error={errors['card.expiry']}
                  onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                  autoComplete="cc-exp"
                />
                <Field
                  label="CVC"
                  inputMode="numeric"
                  placeholder="123"
                  value={card.cvc}
                  error={errors['card.cvc']}
                  onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  autoComplete="cc-csc"
                />
                <Field
                  label="Name on card"
                  value={card.name}
                  error={errors['card.name']}
                  onChange={(e) => setCard({ ...card, name: e.target.value })}
                  autoComplete="cc-name"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  disabled={busy}
                  className="flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-carbon transition hover:bg-accent-light disabled:opacity-60"
                >
                  {busy && <Spinner className="h-4 w-4" />}
                  {busy ? 'Processing…' : `Pay ${formatPrice(totals.total)}`}
                </button>
                <span className="text-xs text-muted">Card details are never stored.</span>
              </div>
            </form>
          )}
        </div>

        <div>
          <div className="sticky top-24 rounded-2xl bg-panel p-6 shadow-sm">
            <h2 className="font-display text-lg">Order summary</h2>
            <ul className="mt-4 space-y-3">
              {(order?.items ?? cart?.items ?? []).map((item) => (
                <li key={item.id} className="flex items-center gap-3 text-sm">
                  {item.image && <img src={item.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="text-muted">×{item.qty}</span>
                  <span className="font-medium">{formatPrice(item.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-line/60 pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatPrice(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{formatPrice(totals.tax)}</dd></div>
              <div className="flex justify-between border-t border-line/60 pt-3 text-base font-semibold">
                <dt>Total</dt><dd>{formatPrice(totals.total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
