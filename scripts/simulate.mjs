#!/usr/bin/env node
/**
 * Parc Fermé — API traffic simulator.
 *
 * Spins up multiple concurrent virtual users (shoppers + an admin) that perform
 * realistic, full-journey sessions against the API: browsing, search, filtering,
 * product detail, images, cart lifecycle, registration/login, checkout, mock
 * payments (including declines), order history, newsletter signups, and the full
 * admin surface (stats, product CRUD, order management, customer views).
 *
 * The goal is to generate lifelike, varied API traffic so that API-discovery,
 * WAF, bot-management and observability tooling can see every endpoint in use.
 *
 *   npm run simulate                         # 3 shoppers + 1 admin, 60s
 *   npm run simulate -- --users 8 --duration 300
 *   npm run simulate -- --loops 5            # each user runs 5 sessions then stops
 *   npm run simulate -- --no-admin --verbose
 *   API_URL=http://localhost:4000 npm run simulate
 *
 * Flags:
 *   --users N        concurrent shopper sessions     (default 3)
 *   --duration S     run for S seconds               (default 60; ignored if --loops set)
 *   --loops N        each user runs N sessions then exits
 *   --delay MIN-MAX  think-time between actions, ms   (default 500-2000)
 *   --base URL       API base URL                     (default $API_URL or http://localhost:4000)
 *   --no-admin       skip the admin persona
 *   --verbose        log every request line
 *   --quiet          suppress the periodic status line
 *
 * Note: the API itself does no rate limiting — that is handled at the edge
 * by Fastly. Heavy runs from one IP may be throttled/blocked there.
 */

// ----------------------------- config -----------------------------

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const BASE = (flag('base', process.env.API_URL) || 'http://localhost:4000').replace(/\/$/, '');
const USERS = Math.max(1, Number(flag('users', '3')));
const LOOPS = flag('loops', null) !== null ? Math.max(1, Number(flag('loops', '1'))) : null;
const DURATION_MS = Number(flag('duration', '60')) * 1000;
const [DELAY_MIN, DELAY_MAX] = (flag('delay', '500-2000').split('-').map(Number));
const WITH_ADMIN = !has('no-admin');
const VERBOSE = has('verbose');
const QUIET = has('quiet');

const TEST_CARDS = {
  ok: '4242424242424242',
  declined: '4000000000000002',
  insufficient: '4000000000009995',
};
const SEEDED_CUSTOMERS = [
  { email: 'ava@demo.dev', password: 'Customer123!' },
  { email: 'noah@demo.dev', password: 'Customer123!' },
  { email: 'imani@demo.dev', password: 'Customer123!' },
  { email: 'lucas@demo.dev', password: 'Customer123!' },
];
const ADMIN = { email: 'admin@parcferme.dev', password: 'Admin123!' };
const SEARCH_TERMS = ['helmet', 'carbon', 'monaco', 'signed', 'race', 'wing', 'scale', 'wheel', 'spa', 'podium'];
const SORTS = ['featured', 'price_asc', 'price_desc', 'newest', 'rating'];

// ----------------------------- ansi/util -----------------------------

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = () => sleep(randInt(DELAY_MIN, DELAY_MAX));

// ----------------------------- metrics -----------------------------

const metrics = new Map(); // "METHOD /template" -> { count, statuses: Map<status,count> }
let totalRequests = 0;
let totalErrors = 0;
const startedAt = Date.now();

function record(template, status) {
  // `template` already includes the method, e.g. "GET /api/products/:slug"
  const key = template;
  let m = metrics.get(key);
  if (!m) {
    m = { count: 0, statuses: new Map() };
    metrics.set(key, m);
  }
  m.count++;
  m.statuses.set(status, (m.statuses.get(status) ?? 0) + 1);
  totalRequests++;
  if (status === 0 || status >= 500) totalErrors++;
}

// Canonical endpoint list (from the OpenAPI spec) for the coverage report.
const CANONICAL = [
  'GET /api/health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'GET /api/auth/me',
  'GET /api/categories',
  'GET /api/products',
  'GET /api/products/featured',
  'GET /api/products/:slug',
  'GET /api/images/products/:seed',
  'POST /api/cart',
  'GET /api/cart/:cartId',
  'DELETE /api/cart/:cartId',
  'POST /api/cart/:cartId/items',
  'PATCH /api/cart/:cartId/items/:itemId',
  'DELETE /api/cart/:cartId/items/:itemId',
  'POST /api/orders',
  'GET /api/orders',
  'GET /api/orders/:id',
  'POST /api/payments/intent',
  'POST /api/payments/:paymentId/confirm',
  'POST /api/newsletter',
  'GET /api/admin/stats',
  'GET /api/admin/products',
  'POST /api/admin/products',
  'PUT /api/admin/products/:id',
  'DELETE /api/admin/products/:id',
  'GET /api/admin/orders',
  'GET /api/admin/orders/:id',
  'PATCH /api/admin/orders/:id',
  'GET /api/admin/customers',
  'GET /api/admin/customers/:id',
];

// ----------------------------- request core -----------------------------

async function call(actor, method, apiPath, template, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let status = 0;
  let json;
  try {
    const res = await fetch(`${BASE}${apiPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    const ct = res.headers.get('content-type') ?? '';
    json = ct.includes('application/json') ? await res.json() : undefined;
  } catch {
    status = 0; // network error / server down
  }
  record(template, status);
  if (VERBOSE) {
    const color = status === 0 || status >= 500 ? c.red : status >= 400 ? c.yellow : c.green;
    console.log(`  ${color(String(status).padStart(3))} ${c.dim(actor.name.padEnd(10))} ${method.padEnd(6)} ${apiPath}`);
  }
  return { status, json };
}

// ----------------------------- shopper persona -----------------------------

class Shopper {
  constructor(i) {
    this.name = `shopper-${i}`;
    this.token = null;
    this.email = null;
    this.cartId = null;
  }

  async ensureAuth() {
    if (this.token) return;
    if (chance(0.4)) {
      // register a fresh ephemeral account
      const email = `sim-${Date.now()}-${randInt(1000, 9999)}@sim.dev`;
      const res = await call(this, 'POST', '/api/auth/register', 'POST /api/auth/register', {
        body: { name: `Sim Shopper ${randInt(1, 999)}`, email, password: 'Password1!' },
      });
      if (res.status === 201 && res.json?.token) {
        this.token = res.json.token;
        this.email = email;
        return;
      }
    }
    // log in as a seeded customer
    const cred = pick(SEEDED_CUSTOMERS);
    const res = await call(this, 'POST', '/api/auth/login', 'POST /api/auth/login', { body: cred });
    if (res.status === 200 && res.json?.token) {
      this.token = res.json.token;
      this.email = cred.email;
    }
  }

  async browse() {
    await call(this, 'GET', '/api/products/featured', 'GET /api/products/featured');
    await think();
    await call(this, 'GET', '/api/categories', 'GET /api/categories');
    await think();

    // a few list queries with varied params (good for API discovery / WAF)
    const queries = randInt(1, 3);
    for (let i = 0; i < queries; i++) {
      const params = new URLSearchParams();
      if (chance(0.6)) params.set('search', pick(SEARCH_TERMS));
      if (chance(0.5)) params.set('category', pick(['helmets', 'race-worn', 'models', 'parts', 'prints', 'collectibles']));
      if (chance(0.4)) params.set('sort', pick(SORTS));
      if (chance(0.3)) params.set('minPrice', String(randInt(50, 500)));
      if (chance(0.3)) params.set('maxPrice', String(randInt(800, 5000)));
      params.set('page', String(randInt(1, 2)));
      await call(this, 'GET', `/api/products?${params}`, 'GET /api/products');
      await think();
    }
  }

  async viewProductAndImage() {
    const res = await call(this, 'GET', '/api/products?pageSize=24', 'GET /api/products');
    const items = res.json?.items ?? [];
    if (items.length === 0) return null;
    const product = pick(items);
    await think();
    const detail = await call(this, 'GET', `/api/products/${product.slug}`, 'GET /api/products/:slug');
    // fetch the product image like a real browser (CDN-cacheable asset)
    const imgPath = detail.json?.product?.image ?? product.image;
    if (imgPath) {
      await call(this, 'GET', imgPath, 'GET /api/images/products/:seed');
    }
    return detail.json?.product ?? product;
  }

  async buildCart() {
    const created = await call(this, 'POST', '/api/cart', 'POST /api/cart');
    if (created.status !== 201) return false;
    this.cartId = created.json.cart.id;
    await think();

    const list = await call(this, 'GET', '/api/products?pageSize=24', 'GET /api/products');
    const items = list.json?.items?.filter((p) => p.stock > 0) ?? [];
    if (items.length === 0) return false;

    const n = randInt(1, 3);
    for (let i = 0; i < n; i++) {
      const p = pick(items);
      const add = await call(this, 'POST', `/api/cart/${this.cartId}/items`, 'POST /api/cart/:cartId/items', {
        body: { productId: p.id, qty: randInt(1, 2) },
      });
      // sometimes adjust quantity of the line we just added
      if (add.status === 201 && chance(0.4)) {
        const line = add.json.cart.items.find((it) => it.productId === p.id);
        if (line) {
          await think();
          await call(this, 'PATCH', `/api/cart/${this.cartId}/items/${line.id}`, 'PATCH /api/cart/:cartId/items/:itemId', {
            body: { qty: randInt(1, 3) },
          });
        }
      }
      await think();
    }

    const view = await call(this, 'GET', `/api/cart/${this.cartId}`, 'GET /api/cart/:cartId');
    // occasionally remove a line (abandon part of the cart)
    if (chance(0.45) && view.json?.cart?.items?.length > 1) {
      await think();
      await call(this, 'DELETE', `/api/cart/${this.cartId}/items/${view.json.cart.items[0].id}`, 'DELETE /api/cart/:cartId/items/:itemId');
    }
    return (view.json?.cart?.items?.length ?? 0) > 0;
  }

  async checkout() {
    await this.ensureAuth();
    if (!this.token || !this.cartId) return;

    const order = await call(this, 'POST', '/api/orders', 'POST /api/orders', {
      token: this.token,
      body: {
        cartId: this.cartId,
        shipping: {
          name: 'Sim Shopper',
          line1: `${randInt(1, 999)} Circuit Drive`,
          city: pick(['Portland', 'Austin', 'Reno', 'Denver']),
          postalCode: String(randInt(10000, 99999)),
          country: 'United States',
        },
      },
    });
    if (order.status !== 201) return;
    const orderId = order.json.order.id;
    await think();

    // ~30% of shoppers hit a decline first, then retry with a good card
    if (chance(0.3)) {
      const declineIntent = await call(this, 'POST', '/api/payments/intent', 'POST /api/payments/intent', {
        token: this.token,
        body: { orderId },
      });
      if (declineIntent.status === 201) {
        await think();
        await call(this, 'POST', `/api/payments/${declineIntent.json.payment.id}/confirm`, 'POST /api/payments/:paymentId/confirm', {
          token: this.token,
          body: { card: { number: pick([TEST_CARDS.declined, TEST_CARDS.insufficient]), expMonth: 12, expYear: 2030, cvc: '123', name: 'Sim Shopper' } },
        });
        await think();
      }
    }

    // ~80% of carts that reach payment complete successfully
    if (chance(0.8)) {
      const intent = await call(this, 'POST', '/api/payments/intent', 'POST /api/payments/intent', {
        token: this.token,
        body: { orderId },
      });
      if (intent.status === 201) {
        await think();
        await call(this, 'POST', `/api/payments/${intent.json.payment.id}/confirm`, 'POST /api/payments/:paymentId/confirm', {
          token: this.token,
          body: { card: { number: TEST_CARDS.ok, expMonth: 12, expYear: 2030, cvc: '123', name: 'Sim Shopper' } },
        });
        await think();
        await call(this, 'GET', `/api/orders/${orderId}`, 'GET /api/orders/:id', { token: this.token });
      }
    }

    // review order history
    await think();
    await call(this, 'GET', '/api/orders', 'GET /api/orders', { token: this.token });
    await call(this, 'GET', '/api/auth/me', 'GET /api/auth/me', { token: this.token });
  }

  async maybeExtras() {
    if (chance(0.3)) {
      await call(this, 'POST', '/api/newsletter', 'POST /api/newsletter', {
        body: { email: `sim-${Date.now()}-${randInt(1000, 9999)}@news.dev` },
      });
    }
    if (chance(0.15) && this.cartId) {
      await call(this, 'DELETE', `/api/cart/${this.cartId}`, 'DELETE /api/cart/:cartId');
    }
    if (chance(0.5)) {
      await call(this, 'GET', '/api/health', 'GET /api/health');
    }
  }

  async session() {
    this.cartId = null;
    await this.browse();
    await this.viewProductAndImage();
    await think();
    const hasItems = await this.buildCart();
    if (hasItems && chance(0.75)) {
      await this.checkout();
    }
    await this.maybeExtras();
  }
}

// ----------------------------- admin persona -----------------------------

class Admin {
  constructor() {
    this.name = 'admin';
    this.token = null;
  }

  async ensureAuth() {
    if (this.token) return;
    const res = await call(this, 'POST', '/api/auth/login', 'POST /api/auth/login', { body: ADMIN });
    if (res.status === 200) this.token = res.json.token;
  }

  async session() {
    await this.ensureAuth();
    if (!this.token) return;
    const t = this.token;

    await call(this, 'GET', '/api/admin/stats', 'GET /api/admin/stats', { token: t });
    await think();
    await call(this, 'GET', '/api/admin/products', 'GET /api/admin/products', { token: t });
    await think();

    // product CRUD
    const created = await call(this, 'POST', '/api/admin/products', 'POST /api/admin/products', {
      token: t,
      body: {
        name: `Sim Lot ${Date.now()}`,
        description: 'Created by the traffic simulator.',
        priceCents: randInt(2000, 200000),
        categoryId: randInt(1, 6),
        stock: randInt(1, 25),
        badge: pick([null, 'New', 'Limited', 'Signed']),
      },
    });
    if (created.status === 201) {
      const id = created.json.product.id;
      await think();
      await call(this, 'PUT', `/api/admin/products/${id}`, 'PUT /api/admin/products/:id', {
        token: t,
        body: {
          name: created.json.product.name,
          description: 'Updated by the simulator.',
          priceCents: created.json.product.priceCents + 1000,
          categoryId: randInt(1, 6),
          stock: randInt(1, 30),
        },
      });
      await think();
      // tidy up most of the time so the catalogue doesn't fill with sim lots
      if (chance(0.8)) {
        await call(this, 'DELETE', `/api/admin/products/${id}`, 'DELETE /api/admin/products/:id', { token: t });
        await think();
      }
    }

    // order management
    const status = pick(['paid', 'shipped', 'delivered']);
    const orders = await call(this, 'GET', `/api/admin/orders?status=${status}`, 'GET /api/admin/orders', { token: t });
    await think();
    const allOrders = await call(this, 'GET', '/api/admin/orders', 'GET /api/admin/orders', { token: t });
    const orderList = allOrders.json?.orders ?? orders.json?.orders ?? [];
    if (orderList.length > 0) {
      const order = pick(orderList);
      await call(this, 'GET', `/api/admin/orders/${order.id}`, 'GET /api/admin/orders/:id', { token: t });
      await think();
      await call(this, 'PATCH', `/api/admin/orders/${order.id}`, 'PATCH /api/admin/orders/:id', {
        token: t,
        body: { status: pick(['paid', 'shipped', 'delivered']) },
      });
      await think();
    }

    // customer views
    const customers = await call(this, 'GET', '/api/admin/customers', 'GET /api/admin/customers', { token: t });
    const custList = customers.json?.customers ?? [];
    if (custList.length > 0) {
      const cust = pick(custList);
      await think();
      await call(this, 'GET', `/api/admin/customers/${cust.id}`, 'GET /api/admin/customers/:id', { token: t });
    }
  }
}

// ----------------------------- runner -----------------------------

let running = true;
const deadline = Date.now() + DURATION_MS;

function keepGoing(loopCount) {
  if (!running) return false;
  if (LOOPS !== null) return loopCount < LOOPS;
  return Date.now() < deadline;
}

async function runActor(actor) {
  let loops = 0;
  while (keepGoing(loops)) {
    try {
      await actor.session();
    } catch (err) {
      if (VERBOSE) console.log(c.red(`  ${actor.name} session error: ${err.message}`));
    }
    loops++;
    if (keepGoing(loops)) await think();
  }
  return loops;
}

function statusSummary(statuses) {
  return [...statuses.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([s, n]) => {
      const label = s === 0 ? 'ERR' : String(s);
      const col = s === 0 || s >= 500 ? c.red : s >= 400 ? c.yellow : c.green;
      return `${col(label)}:${n}`;
    })
    .join(' ');
}

function printReport() {
  const elapsed = (Date.now() - startedAt) / 1000;
  console.log('\n' + c.bold('─'.repeat(78)));
  console.log(c.bold('  Endpoint coverage'));
  console.log(c.bold('─'.repeat(78)));

  const keys = [...metrics.keys()].sort();
  const width = Math.max(...keys.map((k) => k.length), 38);
  for (const key of keys) {
    const m = metrics.get(key);
    console.log(`  ${key.padEnd(width)}  ${String(m.count).padStart(4)}  ${statusSummary(m.statuses)}`);
  }

  const hit = new Set([...metrics.keys()]);
  const missed = CANONICAL.filter((e) => !hit.has(e));
  console.log(c.bold('─'.repeat(78)));
  const covered = CANONICAL.length - missed.length;
  const pct = Math.round((covered / CANONICAL.length) * 100);
  console.log(
    `  ${c.bold('Coverage:')} ${covered}/${CANONICAL.length} documented endpoints (${pct}%)` +
      `   ${c.bold('Requests:')} ${totalRequests}   ${c.bold('Errors:')} ${totalErrors}` +
      `   ${c.bold('Rate:')} ${(totalRequests / elapsed).toFixed(1)}/s over ${elapsed.toFixed(0)}s`
  );
  if (missed.length > 0) {
    console.log(c.yellow(`  Not exercised this run: ${missed.join(', ')}`));
  } else {
    console.log(c.green('  ✔ Every documented endpoint was exercised.'));
  }
  console.log('');
}

async function preflight() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(c.red(`\n✘ Cannot reach the API at ${BASE} (${err.message}).`));
    console.error(c.dim('  Start it with `npm run dev` (or `npm run dev:api`) and try again.\n'));
    process.exit(1);
  }
}

// periodic status line
let ticker;
function startTicker() {
  if (QUIET) return;
  ticker = setInterval(() => {
    const elapsed = (Date.now() - startedAt) / 1000;
    const remain = LOOPS !== null ? '' : `  ~${Math.max(0, (deadline - Date.now()) / 1000).toFixed(0)}s left`;
    process.stdout.write(
      c.dim(`  … ${totalRequests} requests · ${(totalRequests / elapsed).toFixed(1)}/s · ${metrics.size} distinct endpoints${remain}\n`)
    );
  }, 5000);
}

process.on('SIGINT', () => {
  running = false;
  console.log(c.yellow('\n  Interrupted — finishing in-flight sessions…'));
});

// ----------------------------- main -----------------------------

const health = await preflight();
console.log(c.bold(`\nParc Fermé traffic simulator → ${BASE}`));
console.log(
  c.dim(
    `  service=${health.service} db=${health.database} · ${USERS} shopper(s)${WITH_ADMIN ? ' + admin' : ''} · ` +
      (LOOPS !== null ? `${LOOPS} session(s) each` : `${DURATION_MS / 1000}s`) +
      ` · think ${DELAY_MIN}-${DELAY_MAX}ms`
  )
);
console.log(c.dim('  Press Ctrl-C to stop early and print the coverage report.\n'));

startTicker();

const actors = Array.from({ length: USERS }, (_, i) => new Shopper(i + 1));
if (WITH_ADMIN) actors.push(new Admin());

await Promise.all(actors.map((a) => runActor(a)));

clearInterval(ticker);
printReport();
process.exit(totalErrors > 0 ? 1 : 0);
