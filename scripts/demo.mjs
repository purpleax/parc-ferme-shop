#!/usr/bin/env node
/**
 * Parc Fermé — API demo script.
 * Exercises the key endpoints end-to-end against a running server.
 *
 *   node scripts/demo.mjs                # full happy-path + error scenarios
 *   node scripts/demo.mjs --flood        # also fire 15 rapid requests to show 429s
 *   API_URL=http://localhost:4000 node scripts/demo.mjs
 */

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const FLOOD = process.argv.includes('--flood');

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
await call('GET', `/orders/${order.id}`, { token: customerToken });
await call('GET', '/orders', { token: customerToken });

banner('AuthZ boundaries');
await call('GET', '/admin/stats', { expect: 401 });
await call('GET', '/admin/stats', { token: customerToken, expect: 403 });

banner('Admin');
const adminLogin = await call('POST', '/auth/login', {
  body: { email: 'admin@parcferme.dev', password: 'Admin123!' },
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

if (FLOOD) {
  banner('Bot demo — flooding /api/newsletter (expect 429s)');
  const results = await Promise.all(
    Array.from({ length: 15 }, (_, i) =>
      fetch(`${BASE}/api/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `bot-${Date.now()}-${i}@flood.dev` }),
      }).then((r) => r.status)
    )
  );
  const counts = results.reduce((acc, s) => ((acc[s] = (acc[s] ?? 0) + 1), acc), {});
  console.log(`    statuses: ${JSON.stringify(counts)} ${counts['429'] ? green('— rate limiting works ✔') : red('— expected some 429s!')}`);
  if (!counts['429']) process.exitCode = 1;
}

console.log(
  process.exitCode
    ? red('\n✘ Demo finished with unexpected responses — see above.\n')
    : green('\n✔ All demo scenarios behaved as expected.\n')
);
