#!/usr/bin/env node
/**
 * Parc Fermé — API demo script.
 * Exercises the key endpoints end-to-end against a running server.
 *
 *   node scripts/demo.mjs                # full happy-path + error scenarios
 *   API_URL=http://localhost:4000 node scripts/demo.mjs
 *   ADMIN_PASSWORD=… node scripts/demo.mjs   # admin creds for a hardened deploy
 *                                            # (ADMIN_EMAIL too; default the demo values)
 */

const BASE = process.env.API_URL ?? 'http://localhost:4000';
// Admin credentials default to the dev/test demo values. Override when running
// against a hardened deployment where the admin password is env-set/random.
const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@parcferme.dev',
  password: process.env.ADMIN_PASSWORD ?? 'Admin123!',
};

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

let step = 0;
function banner(title) {
  step++;
  console.log(`\n${bold(`${String(step).padStart(2, '0')}. ${title}`)}`);
}

async function call(method, path, { body, token, expect = 200 } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const requestId = res.headers.get('x-request-id') ?? '-';
  const data = await res.json().catch(() => ({}));
  const ok = res.status === expect;
  console.log(
    `    ${ok ? green('✔') : red('✘')} ${method.padEnd(6)} /api${path} ${dim(`→ ${res.status} (expected ${expect}) req=${requestId.slice(0, 8)}`)}`
  );
  if (!ok) {
    console.log(red(`      Unexpected response: ${JSON.stringify(data).slice(0, 300)}`));
    process.exitCode = 1;
  }
  return data;
}

console.log(bold(`\nParc Fermé API demo — ${BASE}`));

banner('Health check');
const health = await call('GET', '/health');
console.log(dim(`    service=${health.service} db=${health.database}`));

banner('Browse the catalogue');
const products = await call('GET', '/products?pageSize=4');
console.log(dim(`    ${products.total} products, showing ${products.items.length}`));
await call('GET', '/products?category=helmets&sort=price_asc');
await call('GET', '/products?search=carbon');
await call('GET', '/categories');
await call('GET', `/products/${products.items[0].slug}`);

banner('Validation errors return structured details');
await call('GET', '/products?page=0&sort=bogus', { expect: 400 });
await call('POST', '/newsletter', { body: { email: 'not-an-email' }, expect: 400 });

banner('Customer auth');
const reg = await call('POST', '/auth/register', {
  body: { name: 'Demo Shopper', email: `shopper-${Date.now()}@demo.dev`, password: 'Password1!' },
  expect: 201,
});
const login = await call('POST', '/auth/login', {
  body: { email: 'ava@demo.dev', password: 'Customer123!' },
});
const customerToken = login.token;
await call('POST', '/auth/login', {
  body: { email: 'ava@demo.dev', password: 'wrong' },
  expect: 401,
});
await call('GET', '/auth/me', { token: customerToken });
console.log(dim(`    registered ${reg.user?.email}, logged in as ${login.user?.email}`));

banner('Password reset (attempt + failure)');
// Always 200, even for unknown emails (anti-enumeration); no email is sent.
await call('POST', '/auth/forgot-password', { body: { email: 'ava@demo.dev' } });
// A bogus token is rejected (X-Auth-Event: password-reset-failure at the edge).
await call('POST', '/auth/reset-password', {
  body: { token: 'not-a-real-token', password: 'BrandNew123' },
  expect: 400,
});

banner('Cart');
const { cart } = await call('POST', '/cart', { expect: 201 });
const productId = products.items[0].id;
await call('POST', `/cart/${cart.id}/items`, { body: { productId, qty: 2 }, expect: 201 });
const cartView = await call('GET', `/cart/${cart.id}`);
console.log(dim(`    cart subtotal: $${(cartView.cart.subtotalCents / 100).toFixed(2)}`));

banner('Checkout — create order');
const { order } = await call('POST', '/orders', {
  token: customerToken,
  expect: 201,
  body: {
    cartId: cart.id,
    shipping: {
      name: 'Ava Chen', line1: '14 Foundry Lane', city: 'Portland',
      postalCode: '97209', country: 'United States',
    },
  },
});
console.log(dim(`    order ${order.id}: $${(order.totalCents / 100).toFixed(2)} (${order.status})`));

banner('Mock payment — declined card, then success');
const intent1 = await call('POST', '/payments/intent', {
  token: customerToken, expect: 201, body: { orderId: order.id },
});
await call('POST', `/payments/${intent1.payment.id}/confirm`, {
  token: customerToken,
  expect: 402,
  body: { card: { number: '4000000000000002', expMonth: 12, expYear: 2030, cvc: '123', name: 'Ava Chen' } },
});
const intent2 = await call('POST', '/payments/intent', {
  token: customerToken, expect: 201, body: { orderId: order.id },
});
const paid = await call('POST', `/payments/${intent2.payment.id}/confirm`, {
  token: customerToken,
  body: { card: { number: '4242424242424242', expMonth: 12, expYear: 2030, cvc: '123', name: 'Ava Chen' } },
});
console.log(dim(`    paid with ${paid.payment?.cardBrand} •••• ${paid.payment?.cardLast4}`));
const confirmed = await call('GET', `/orders/${order.id}`, { token: customerToken });
// The payment response alone doesn't prove the order flipped — check the DB state.
if (confirmed.order?.status !== 'paid') {
  console.log(red(`      Order ${order.id} should be paid, got ${confirmed.order?.status}`));
  process.exitCode = 1;
}
await call('GET', '/orders', { token: customerToken });

banner('AuthZ boundaries');
await call('GET', '/admin/stats', { expect: 401 });
await call('GET', '/admin/stats', { token: customerToken, expect: 403 });

banner('Admin');
const adminLogin = await call('POST', '/auth/login', {
  body: { email: ADMIN.email, password: ADMIN.password },
});
const adminToken = adminLogin.token;
const stats = await call('GET', '/admin/stats', { token: adminToken });
console.log(dim(`    revenue $${(stats.stats.revenueCents / 100).toFixed(2)} across ${stats.stats.orderCount} orders`));
await call('GET', '/admin/orders?status=paid', { token: adminToken });
await call('GET', '/admin/customers', { token: adminToken });
const created = await call('POST', '/admin/products', {
  token: adminToken,
  expect: 201,
  body: { name: `Demo Team Cap ${Date.now()}`, description: 'Created by demo script', priceCents: 2900, categoryId: 1, stock: 10 },
});
await call('DELETE', `/admin/products/${created.product.id}`, { token: adminToken });

console.log(
  process.exitCode
    ? red('\n✘ Demo finished with unexpected responses — see above.\n')
    : green('\n✔ All demo scenarios behaved as expected.\n')
);
