import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

process.env.DATABASE_PATH = ':memory:';
process.env.RESET_TEST_DOMAIN = 'resettest.dev';

let app: Express;
let customerToken: string;
let adminToken: string;

const TEST_CARD_OK = '4242424242424242';
const TEST_CARD_DECLINED = '4000000000000002';

beforeAll(async () => {
  const { db } = await import('../src/db.js');
  const { seedDatabase } = await import('../src/seed.js');
  const { createApp } = await import('../src/app.js');
  seedDatabase(db);
  app = createApp();

  const customer = await request(app)
    .post('/api/auth/login')
    .send({ email: 'ava@demo.dev', password: 'Customer123!' });
  customerToken = customer.body.token;
  const admin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@parcferme.dev', password: 'Admin123!' });
  adminToken = admin.body.token;
});

describe('health & tracing', () => {
  it('returns ok with a request id header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns a structured 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });
});

describe('catalog', () => {
  it('lists products with pagination', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(12);
    expect(res.body.total).toBe(24);
    expect(res.body.totalPages).toBe(2);
  });

  it('filters by category and price', async () => {
    const res = await request(app).get('/api/products?category=prints&maxPrice=200');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const p of res.body.items) {
      expect(p.category.slug).toBe('prints');
      expect(p.priceCents).toBeLessThanOrEqual(20000);
    }
  });

  it('searches by name', async () => {
    const res = await request(app).get('/api/products?search=monza');
    expect(res.status).toBe(200);
    expect(res.body.items[0].name).toContain('Monza');
  });

  it('rejects invalid query params', async () => {
    const res = await request(app).get('/api/products?page=0&sort=bogus');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns product detail with related items', async () => {
    const res = await request(app).get('/api/products/1992-monza-podium-replica-helmet');
    expect(res.status).toBe(200);
    expect(res.body.product.sku).toBe('PF-HE-001');
    expect(res.body.related.length).toBeGreaterThan(0);
  });

  it('404s on missing product', async () => {
    const res = await request(app).get('/api/products/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('serves cacheable SVG product images', async () => {
    const res = await request(app).get('/api/images/products/some-custom-product.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.headers['cache-control']).toContain('max-age=86400');
  });

  it('lists categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.body.categories.length).toBe(6);
  });
});

describe('cache control', () => {
  // `private` is what makes Fastly's default VCL bypass its cache; `no-store`
  // covers browser/intermediary caches.
  it('marks admin responses private + no-store (never cacheable at the edge)', async () => {
    const res = await request(app).get('/api/admin/products').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('marks authenticated responses private + no-store', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${customerToken}`);
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('leaves the public catalogue cacheable', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBeUndefined();
  });
});

describe('auth', () => {
  it('registers a new customer', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'Password1' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('customer');
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'Password1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects weak passwords with field details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'bad', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('rejects wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ava@demo.dev', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the current user with a valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ava@demo.dev');
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a JWT forged with the old public default secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign(
      { sub: '1', email: 'attacker@evil.test', name: 'Mallory', role: 'admin' },
      'parc-ferme-demo-secret-change-me',
      { algorithm: 'HS256' }
    );
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(me.status).toBe(401);
    const admin = await request(app).get('/api/admin/customers').set('Authorization', `Bearer ${forged}`);
    expect(admin.status).toBe(401);
  });

  it('rejects an unsigned (alg=none) token', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1', role: 'admin' })}.`;
    const res = await request(app).get('/api/admin/customers').set('Authorization', `Bearer ${none}`);
    expect(res.status).toBe(401);
  });


  it('tags login success and failure with X-Auth-Event', async () => {
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ava@demo.dev', password: 'Customer123!' });
    expect(ok.status).toBe(200);
    expect(ok.headers['x-auth-event']).toBe('login-success');

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ava@demo.dev', password: 'nope' });
    expect(bad.status).toBe(401);
    expect(bad.headers['x-auth-event']).toBe('login-failure');
  });
});

describe('password reset', () => {
  const email = 'reset-me@example.com';

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Reset Me', email, password: 'Original1' });
  });

  // The raw token never leaves the server (it's logged, not returned), so pull
  // it straight from the DB the way an operator would read it from the logs.
  async function issueToken(): Promise<string> {
    const crypto = await import('node:crypto');
    const { db } = await import('../src/db.js');
    const raw = crypto.randomBytes(32).toString('hex');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number };
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, crypto.createHash('sha256').update(raw).digest('hex'), new Date(Date.now() + 60000).toISOString());
    return raw;
  }

  it('always returns 200 + password-reset-attempt, even for unknown emails', async () => {
    const known = await request(app).post('/api/auth/forgot-password').send({ email });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.headers['x-auth-event']).toBe('password-reset-attempt');
    expect(unknown.headers['x-auth-event']).toBe('password-reset-attempt');
    // Identical bodies — the response cannot be used to enumerate accounts.
    expect(known.body).toEqual(unknown.body);
  });

  it('resets the password with a valid token and tags password-reset-success', async () => {
    const token = await issueToken();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'BrandNew1' });
    expect(res.status).toBe(200);
    expect(res.headers['x-auth-event']).toBe('password-reset-success');

    // The new password actually works, and the old one no longer does.
    const good = await request(app).post('/api/auth/login').send({ email, password: 'BrandNew1' });
    expect(good.status).toBe(200);
    const stale = await request(app).post('/api/auth/login').send({ email, password: 'Original1' });
    expect(stale.status).toBe(401);
  });

  it('rejects an invalid token with password-reset-failure', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', password: 'BrandNew1' });
    expect(res.status).toBe(400);
    expect(res.headers['x-auth-event']).toBe('password-reset-failure');
  });

  it('rejects a reused token with password-reset-failure', async () => {
    const token = await issueToken();
    const first = await request(app).post('/api/auth/reset-password').send({ token, password: 'Reused123' });
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/auth/reset-password').send({ token, password: 'Reused456' });
    expect(second.status).toBe(400);
    expect(second.headers['x-auth-event']).toBe('password-reset-failure');
  });

  it('rejects a weak new password with password-reset-failure', async () => {
    const token = await issueToken();
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.headers['x-auth-event']).toBe('password-reset-failure');
  });

  it('returns the reset token in the response for the configured test domain', async () => {
    const testEmail = 'flood-1@resettest.dev';
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Flood One', email: testEmail, password: 'FloodPass1' });

    // forgot-password hands back the token directly — no log-reading needed.
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: testEmail });
    expect(forgot.status).toBe(200);
    expect(forgot.headers['x-auth-event']).toBe('password-reset-attempt');
    expect(typeof forgot.body.resetToken).toBe('string');

    // That token completes a real reset (the success signal), end to end.
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.resetToken, password: 'FloodNew123' });
    expect(reset.status).toBe(200);
    expect(reset.headers['x-auth-event']).toBe('password-reset-success');

    const login = await request(app).post('/api/auth/login').send({ email: testEmail, password: 'FloodNew123' });
    expect(login.status).toBe(200);
  });

  it('never returns a reset token for non-test-domain emails', async () => {
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'ava@demo.dev' });
    expect(forgot.status).toBe(200);
    expect(forgot.body.resetToken).toBeUndefined();
    expect(forgot.body.resetUrl).toBeUndefined();
  });
});

describe('cart → checkout → payment flow', () => {
  let cartId: string;
  let orderId: string;
  let paymentId: string;

  it('creates a cart and adds items', async () => {
    const created = await request(app).post('/api/cart');
    expect(created.status).toBe(201);
    cartId = created.body.cart.id;

    const products = await request(app).get('/api/products?search=monza podium');
    const productId = products.body.items[0].id;

    const added = await request(app).post(`/api/cart/${cartId}/items`).send({ productId, qty: 2 });
    expect(added.status).toBe(201);
    expect(added.body.cart.itemCount).toBe(2);
    expect(added.body.cart.subtotalCents).toBe(2 * 28900);
  });

  it('updates and validates quantities', async () => {
    const cart = await request(app).get(`/api/cart/${cartId}`);
    const itemId = cart.body.cart.items[0].id;
    const updated = await request(app).patch(`/api/cart/${cartId}/items/${itemId}`).send({ qty: 1 });
    expect(updated.status).toBe(200);
    expect(updated.body.cart.itemCount).toBe(1);

    const tooMany = await request(app).patch(`/api/cart/${cartId}/items/${itemId}`).send({ qty: 999 });
    expect(tooMany.status).toBe(400);
  });

  it('requires auth to create an order', async () => {
    const res = await request(app).post('/api/orders').send({ cartId, shipping: {} });
    expect(res.status).toBe(401);
  });

  it('creates an order from the cart', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        cartId,
        shipping: { name: 'Ava Chen', line1: '14 Foundry Lane', city: 'Portland', postalCode: '97209', country: 'United States' },
      });
    expect(res.status).toBe(201);
    orderId = res.body.order.id;
    expect(res.body.order.status).toBe('pending_payment');
    expect(res.body.order.subtotalCents).toBe(28900);
    expect(res.body.order.shippingCents).toBe(0); // free over $250
    expect(res.body.order.taxCents).toBe(Math.round(28900 * 0.08));
  });

  it('declines the decline test card with a 402', async () => {
    const intent = await request(app)
      .post('/api/payments/intent')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId });
    expect(intent.status).toBe(201);

    const res = await request(app)
      .post(`/api/payments/${intent.body.payment.id}/confirm`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ card: { number: TEST_CARD_DECLINED, expMonth: 12, expYear: 2030, cvc: '123', name: 'Ava Chen' } });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PAYMENT_DECLINED');
    expect(res.body.error.details.declineCode).toBe('card_declined');
  });

  it('completes payment with the success test card', async () => {
    const intent = await request(app)
      .post('/api/payments/intent')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId });
    paymentId = intent.body.payment.id;

    const res = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ card: { number: TEST_CARD_OK, expMonth: 12, expYear: 2030, cvc: '123', name: 'Ava Chen' } });
    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('succeeded');
    expect(res.body.payment.cardLast4).toBe('4242');

    const order = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(order.body.order.status).toBe('paid');

    // Cart was cleared after successful payment.
    const cart = await request(app).get(`/api/cart/${cartId}`);
    expect(cart.body.cart.itemCount).toBe(0);
  });

  it('rejects an invalid (non-Luhn) card number', async () => {
    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ cartId, shipping: { name: 'A B', line1: 'X street 1', city: 'Y', postalCode: '123', country: 'US' } });
    expect(order.status).toBe(400); // cart now empty
  });

  it('shows the order in customer order history', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.orders.map((o: { id: string }) => o.id);
    expect(ids).toContain(orderId);
  });
});

describe('payment idempotency', () => {
  const GOOD_CARD = { number: TEST_CARD_OK, expMonth: 12, expYear: 2030, cvc: '123', name: 'Ava Chen' };

  // Fresh cart + order per test so the shared checkout-flow state stays untouched.
  async function createPendingOrder() {
    const created = await request(app).post('/api/cart');
    const cartId = created.body.cart.id;
    const products = await request(app).get('/api/products');
    const product = products.body.items.find((p: { stock: number }) => p.stock >= 3);
    await request(app).post(`/api/cart/${cartId}/items`).send({ productId: product.id, qty: 1 });
    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        cartId,
        shipping: { name: 'Ava Chen', line1: '14 Foundry Lane', city: 'Portland', postalCode: '97209', country: 'United States' },
      });
    expect(order.status).toBe(201);
    return { orderId: order.body.order.id as string, productSlug: product.slug as string };
  }

  async function createIntent(orderId: string): Promise<string> {
    const intent = await request(app)
      .post('/api/payments/intent')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId });
    expect(intent.status).toBe(201);
    return intent.body.payment.id;
  }

  const confirm = (paymentId: string) =>
    request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ card: GOOD_CARD });

  async function stockOf(slug: string): Promise<number> {
    const res = await request(app).get(`/api/products/${slug}`);
    return res.body.product.stock;
  }

  it('rejects confirming the same payment twice', async () => {
    const { orderId } = await createPendingOrder();
    const paymentId = await createIntent(orderId);
    expect((await confirm(paymentId)).status).toBe(200);
    const second = await confirm(paymentId);
    expect(second.status).toBe(400);
    expect(second.body.error.message).toContain('already succeeded');
  });

  it('rejects a stale second intent once the order is paid, decrementing stock once', async () => {
    const { orderId, productSlug } = await createPendingOrder();
    const stockBefore = await stockOf(productSlug);
    // Both intents are created while the order is still pending.
    const intentA = await createIntent(orderId);
    const intentB = await createIntent(orderId);

    expect((await confirm(intentA)).status).toBe(200);
    const stale = await confirm(intentB);
    expect(stale.status).toBe(400);
    expect(stale.body.error.message).toContain('cannot be paid again');
    expect(await stockOf(productSlug)).toBe(stockBefore - 1);
  });

  it('lets exactly one of two concurrent confirms win', async () => {
    const { orderId, productSlug } = await createPendingOrder();
    const stockBefore = await stockOf(productSlug);
    const paymentId = await createIntent(orderId);
    // Both requests pass the pre-checks before the simulated processor delay;
    // the conditional finalize must let only one through.
    const [a, b] = await Promise.all([confirm(paymentId), confirm(paymentId)]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(await stockOf(productSlug)).toBe(stockBefore - 1);
  });
});

describe('admin', () => {
  it('blocks customers from admin endpoints', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns dashboard stats for admins', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.revenueCents).toBeGreaterThan(0);
    expect(res.body.stats.recentOrders.length).toBeGreaterThan(0);
  });

  it('creates, updates and soft-deletes a product', async () => {
    const created = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Candle', priceCents: 2900, categoryId: 1, stock: 5, description: 'A test product' });
    expect(created.status).toBe(201);
    const id = created.body.product.id;

    const updated = await request(app)
      .put(`/api/admin/products/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Candle XL', priceCents: 3900, categoryId: 1, stock: 8, description: 'Bigger' });
    expect(updated.status).toBe(200);
    expect(updated.body.product.priceCents).toBe(3900);

    const deleted = await request(app)
      .delete(`/api/admin/products/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);

    const publicView = await request(app).get(`/api/products/${created.body.product.slug}`);
    expect(publicView.status).toBe(404);
  });

  it('lists orders and updates status', async () => {
    const list = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.orders.length).toBeGreaterThan(0);
    const target = list.body.orders.find((o: { status: string }) => o.status === 'paid');

    const patched = await request(app)
      .patch(`/api/admin/orders/${target.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'shipped' });
    expect(patched.status).toBe(200);
    expect(patched.body.order.status).toBe('shipped');
  });

  it('lists customers with totals', async () => {
    const res = await request(app).get('/api/admin/customers').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const ava = res.body.customers.find((c: { email: string }) => c.email === 'ava@demo.dev');
    expect(ava.orderCount).toBeGreaterThan(0);
    expect(ava.totalSpentCents).toBeGreaterThan(0);
  });
});

describe('newsletter (bot demo target)', () => {
  it('subscribes a valid email', async () => {
    const res = await request(app).post('/api/newsletter').send({ email: 'bot-demo@example.com' });
    expect(res.status).toBe(201);
  });

  it('409s on duplicates and 400s on junk', async () => {
    const dupe = await request(app).post('/api/newsletter').send({ email: 'bot-demo@example.com' });
    expect(dupe.status).toBe(409);
    const junk = await request(app).post('/api/newsletter').send({ email: 'not-an-email' });
    expect(junk.status).toBe(400);
  });
});
