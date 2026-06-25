# Parc Fermé — Demo Ecommerce Store

A flagship, design-forward, **API-first** ecommerce demo store built for security
demonstrations: CDN caching, WAF, bot management, API discovery, rate limiting,
logging and abuse scenarios. The storefront is **Parc Fermé**, a fictional
authenticated Formula 1 memorabilia house. Everything is fictional — no real
products, payments or personal data.

**Stack:** React 18 + Vite + TypeScript + Tailwind v4 (frontend) ·
Node.js + Express 4 + TypeScript (API) · SQLite via the built-in `node:sqlite`
module (no native build step) · JWT auth · mock payments · OpenAPI/Swagger docs.

---

## Quick start (local, no Docker)

**Requirement: Node.js 22.5 or newer** (`node -v` to check). Nothing else.

```bash
npm run setup         # installs root, server and client dependencies
npm run seed          # creates server/data/store.db with demo data
npm run fetch-images  # (optional) downloads real F1 photos from Wikimedia Commons
npm run dev           # starts API (:4000) and frontend (:5173) together
```

Product photography is downloaded once into `server/public/products/` by
`npm run fetch-images` (openly-licensed images from Wikimedia Commons; attribution
recorded in `server/public/products/sources.json`). The step is optional and
re-runnable — any product without a photo automatically falls back to generated
SVG artwork, so the store is fully functional without it.

Then open:

| URL | What |
|---|---|
| http://localhost:5173 | The storefront |
| http://localhost:4000/api/docs | Swagger UI (interactive API docs) |
| http://localhost:4000/api/health | API health check |

### Demo credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@parcferme.dev` | `Admin123!` |
| **Customer** | `ava@demo.dev` | `Customer123!` |

(Three more seeded customers — `noah@demo.dev`, `imani@demo.dev`,
`lucas@demo.dev` — all use `Customer123!`.)

### Test credit cards (mock payments only)

| Number | Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 0002` | Declined (`card_declined`, HTTP 402) |
| `4000 0000 0000 9995` | Declined (`insufficient_funds`, HTTP 402) |

Any **future** expiry and any 3–4 digit CVC. Card data is Luhn-validated, used to
derive brand + last4, and **immediately discarded** — it is never stored or logged.

---

## 1. Architecture

```
┌────────────────────┐         ┌─────────────────────────────────┐
│  React SPA (Vite)  │  /api/* │  Express API (TypeScript, tsx)  │
│  localhost:5173    ├────────►│  localhost:4000                 │
│  Tailwind v4       │  proxy  │                                 │
└────────────────────┘         │  • requestId + security headers │
                               │  • structured request logging   │
                               │  • JWT auth (bcrypt hashes)     │
                               │  • Zod validation everywhere    │
                               │  • Swagger UI at /api/docs      │
                               └───────────────┬─────────────────┘
                                               │ node:sqlite (built-in)
                                       ┌───────▼────────┐
                                       │ SQLite (WAL)   │
                                       │ server/data/   │
                                       └────────────────┘
```

Design decisions that matter for a security demo:

- **Every meaningful frontend action is an API call** — browsing, search, cart,
  checkout, payment, admin CRUD. Nothing is faked client-side, so proxies, WAFs
  and API-discovery tools see a realistic, varied traffic shape (~30 endpoints).
- **Request tracing:** every response carries `X-Request-Id` (honours an inbound
  `X-Request-Id` header, so CDN/WAF-injected IDs propagate). Errors echo the id.
- **Logging:** every API request is logged as a console line *and* a JSON line in
  `server/logs/api.log` (timestamp, request id, method, path, status, duration,
  ip, user id, role, user-agent) — easy to tail during demos or ship to a SIEM.
- **Rate limiting is handled at the edge** (Fastly), not in the app — the API
  applies no request throttling of its own, keeping the origin a clean target for
  edge-side rate-limiting and bot-management demos.
- **Cacheable image endpoint:** `/api/images/products/{seed}.jpg` serves real
  product photography and `/api/images/products/{seed}.svg` generates deterministic
  fallback art — both with `Cache-Control: public, max-age=86400, immutable`, ideal
  for demonstrating CDN cache hit ratios.
- **Consistent error envelope:** `{ "error": { "code", "message", "details?",
  "requestId" } }` with realistic status codes (400/401/402/403/404/409).
- **Safe by default:** parameterised SQL everywhere, bcrypt password hashes, JWT
  with server-side role checks on every admin route, strict input validation,
  soft deletes, no intentional vulnerabilities.
- **SQLite via `node:sqlite`** (Node ≥22.5): zero native dependencies, so
  installation never needs a compiler — important for handover machines and
  slim Docker images.
- `trust proxy` is enabled, so the API reads client IPs correctly behind a
  CDN/WAF.

### Money, orders, payments

Prices are integers in cents. Checkout: cart → `POST /api/orders` (creates a
`pending_payment` order with a snapshot of items + totals: 8% tax, $8 shipping,
free over $250) → `POST /api/payments/intent` → `POST /api/payments/{id}/confirm`
with the mock card → order becomes `paid`, stock decrements, cart empties.
Admins progress orders through `paid → shipped → delivered` (or `cancelled`).

## 2. Project structure

```
├── package.json            # root scripts (setup/seed/fetch-images/spec/dev/test/demo/simulate)
├── scripts/
│   ├── demo.mjs            # end-to-end API smoke test (correctness gate)
│   ├── simulate.mjs        # multi-user traffic generator (API discovery/WAF demos)
│   └── fetch-images.mjs    # one-time F1 photo downloader (Wikimedia Commons)
├── Dockerfile              # added last — see Docker section
├── docker-compose.yml
├── server/
│   ├── openapi.json        # static OpenAPI 3.0.3 spec (generated by `npm run spec`)
│   ├── openapi.yaml        # same spec as YAML
│   ├── src/
│   │   ├── index.ts        # entrypoint (auto-seeds empty DB)
│   │   ├── app.ts          # Express app assembly
│   │   ├── config.ts       # env-driven configuration
│   │   ├── db.ts           # node:sqlite wrapper + schema migration
│   │   ├── seed.ts         # demo catalogue, users, orders
│   │   ├── middleware.ts   # requestId, logging, auth, validation
│   │   ├── errors.ts       # ApiError + helpers
│   │   ├── openapi.ts      # OpenAPI spec source of truth (served at /api/docs)
│   │   ├── spec-cli.ts     # exports openapi.ts → openapi.json + openapi.yaml
│   │   └── routes/         # auth, catalog, images, cart, orders+payments,
│   │                       # admin, misc (health/newsletter)
│   ├── public/products/    # product photos (*.jpg) + sources.json attribution
│   ├── test/api.test.ts    # 31 API tests (vitest + supertest, in-memory DB)
│   ├── data/store.db       # SQLite database (created by seed, gitignored)
│   └── logs/api.log        # JSON request log (created at runtime, gitignored)
└── client/
    └── src/
        ├── lib/            # api client, types, formatting, storage
        ├── context/        # Auth, Cart, Toast providers
        ├── components/     # Layout, ProductCard, ui kit, fx (hero interactions)
        ├── pages/          # Home, Shop, ProductDetail, Cart, Checkout,
        │   └── admin/      # OrderConfirmation, AccountOrders, Login/Register
        └── test/           # smoke tests
```

## 3. API overview

Full interactive docs: **http://localhost:4000/api/docs** (live spec at `/api/openapi.json`).

A static **OpenAPI 3.0.3** spec is also committed at
[`server/openapi.json`](server/openapi.json) and
[`server/openapi.yaml`](server/openapi.yaml) — import these into Postman, code
generators, an API gateway/WAF, or an API-discovery tool without running the
server. Regenerate them from the source (`server/src/openapi.ts`) any time with:

```bash
npm run spec      # writes server/openapi.json and server/openapi.yaml
```

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/health` | — | Service health + seed status |
| `POST /api/auth/register` | — | Create customer account |
| `POST /api/auth/login` | — | Get JWT |
| `GET /api/auth/me` | JWT | Current user |
| `GET /api/categories` | — | Categories with product counts |
| `GET /api/products` | — | List/search/filter/sort/paginate products |
| `GET /api/products/featured` | — | Homepage featured set |
| `GET /api/products/{slug}` | — | Product detail + related |
| `GET /api/images/products/{seed}.svg` | — | Cacheable generated product art |
| `POST /api/cart` | — | Create anonymous cart |
| `GET/DELETE /api/cart/{cartId}` | — | Read / empty cart |
| `POST /api/cart/{cartId}/items` | — | Add item (stock-checked) |
| `PATCH/DELETE /api/cart/{cartId}/items/{itemId}` | — | Update qty / remove |
| `POST /api/orders` | JWT | Create order from cart |
| `GET /api/orders` · `GET /api/orders/{id}` | JWT | Order history / detail (ownership enforced) |
| `POST /api/payments/intent` | JWT | Create mock payment intent |
| `POST /api/payments/{id}/confirm` | JWT | Confirm with mock card (402 on decline) |
| `POST /api/newsletter` | — | Subscribe (bot demo target — rate limited at the edge) |
| `GET /api/admin/stats` | admin | Dashboard metrics |
| `GET/POST /api/admin/products` · `PUT/DELETE /api/admin/products/{id}` | admin | Product management (soft delete) |
| `GET /api/admin/orders[?status=]` · `GET/PATCH /api/admin/orders/{id}` | admin | Order viewing + status updates |
| `GET /api/admin/customers` · `GET /api/admin/customers/{id}` | admin | Customer viewing |

### Example curl commands

```bash
# Health + tracing headers
curl -i http://localhost:4000/api/health

# Search the catalogue
curl 'http://localhost:4000/api/products?search=helmet&category=helmets&sort=price_asc'

# Log in and keep the token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ava@demo.dev","password":"Customer123!"}' \
  | sed 's/.*"token":"\([^"]*\)".*/\1/')

# Authenticated request
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/orders

# Admin (will 403 with a customer token — good authz demo)
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/admin/stats

# Validation error (structured 400)
curl -X POST http://localhost:4000/api/newsletter \
  -H 'Content-Type: application/json' -d '{"email":"junk"}'

# Cacheable image (CDN demo)
curl -sI http://localhost:4000/api/images/products/monaco-hairpin-fine-art-print.jpg | grep -i cache
```

## 4. Seed data

`npm run seed` (or first server start with an empty DB) creates:

- 6 categories (Helmets, Race-Worn, Scale Models, Car Parts, Prints & Art,
  Collectibles), 24 F1 memorabilia products (prices, sale prices, badges,
  ratings, stock levels)
- 1 admin + 4 customers (credentials above)
- 5 historical orders in various statuses, with payments — so order history,
  the admin dashboard and customer lifetime-spend are populated immediately

Re-running the seed **resets everything** to this state — handy between demos.

## 5. Testing

```bash
npm test                  # server API tests (31) + client smoke tests (2)
npm run test --prefix server   # just the API tests (in-memory DB, no setup needed)
npm run demo              # live end-to-end script against a RUNNING server
```

The demo script walks the entire customer journey (browse → register/login →
cart → order → declined card → successful payment → order history) plus admin
flows and authz boundaries, printing each request's status and request id. It
exits non-zero if anything responds unexpectedly — usable as a smoke gate.

### Traffic simulator (for API discovery / WAF / bot demos)

`npm run simulate` spins up **multiple concurrent virtual users** — shoppers plus
an admin — that run realistic, full-journey sessions against the live API:
browsing, search, filtered listings, product detail, image fetches, the full cart
lifecycle, registration/login, checkout, mock payments (including deliberate
declines), order history, newsletter signups, and the complete admin surface
(stats, product CRUD, order management with status changes, customer views).

It generates lifelike, varied traffic so that API-discovery, WAF, bot-management
and observability tooling can see every endpoint in use, then prints an
**endpoint coverage report** (request counts + status-code breakdown per route,
and which of the 31 documented endpoints were exercised).

```bash
npm run simulate                              # 3 shoppers + 1 admin, 60s
npm run simulate -- --users 8 --duration 300  # 8 shoppers, run 5 minutes
npm run simulate -- --loops 5                 # each user runs 5 sessions then stops
npm run simulate -- --no-admin --verbose      # shoppers only, log every request
API_URL=https://demo.example.com npm run simulate   # point at any deployment
```

| Flag | Default | Meaning |
|---|---|---|
| `--users N` | `3` | Concurrent shopper sessions |
| `--duration S` | `60` | Run for S seconds (ignored if `--loops` set) |
| `--loops N` | — | Each user runs N sessions, then exits |
| `--delay MIN-MAX` | `500-2000` | Think-time between actions, ms |
| `--base URL` | `$API_URL` or `localhost:4000` | API base URL |
| `--no-admin` | off | Skip the admin persona |
| `--verbose` | off | Log every request line |
| `--quiet` | off | Suppress the periodic status line |

Ctrl-C stops early and still prints the coverage report. **Heads-up:** the API does
no rate limiting of its own — that's handled at the edge by Fastly, so sustained
high-volume runs from one IP may be throttled or blocked there.

## 6. Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `JWT_SECRET` | dev value | Set your own for any shared environment |
| `DATABASE_PATH` | `server/data/store.db` | `:memory:` used by tests |
| `LOG_FILE` | `server/logs/api.log` | JSON request log |

## 7. Docker (only after local verification)

Make sure the app works locally first (section 8 below). Then:

```bash
docker compose up --build
# → http://localhost:4000  (single container: API + built frontend)
```

The container runs as the non-root `node` user and auto-seeds on first start,
persisting the database in the `store-data` named volume. If you ran an earlier
build that crash-looped on `unable to open database file`, delete the stale
root-owned volume first: `docker compose down -v && docker compose up --build`.

Reset to fresh demo data at any time with:

```bash
docker compose down -v && docker compose up
```

For a CDN/WAF demo, point your edge at `http://<host>:4000` — the SPA, the API
and the cacheable image endpoint are all served from that one origin.

## 8. Verification checklist (run before a demo)

1. `node -v` → must be ≥ 22.5.
2. `npm run setup && npm run seed` → ends with “✔ Seeded …” and the demo accounts.
3. `npm test` → 31 server tests + 2 client tests pass.
4. `npm run dev` → banner shows the API on :4000; open http://localhost:5173 —
   you should see the dark “OWN THE APEX” hero with animated speed streaks.
5. `npm run demo` (in a second terminal) → ends with
   “✔ All demo scenarios behaved as expected.”
6. In the browser: add a product to the garage → checkout as `ava@demo.dev` →
   pay with `4242 4242 4242 4242` → confirmation page shows a `PF-…` order.
7. Sign in as `admin@parcferme.dev` → dashboard shows revenue and your new order.
8. `tail -f server/logs/api.log` while clicking around → JSON log lines appear.

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm run seed` fails with `Cannot find module 'node:sqlite'` | Node is older than 22.5. Install Node 22+ (`brew install node` / nvm). |
| Frontend loads but products never appear; console shows proxy errors | API isn't running. Start `npm run dev:api`, check http://localhost:4000/api/health. |
| `EADDRINUSE: 4000` or `5173` | Another process owns the port: `lsof -i :4000` then kill it, or set `PORT=4001` (and update `client/vite.config.ts` proxy). |
| Payment always declines | You're using a decline test card. Use `4242 4242 4242 4242` with a **future** expiry. |
| “Cart not found” after restarting with a re-seed | The browser kept an old cart id. The app auto-recovers on next add-to-cart; or clear the site's localStorage. |
| Data looks messy after experimenting | `npm run seed` resets everything to pristine demo state. |
| A product shows old/wrong artwork after re-running `fetch-images` | Images are served with a 1-day `immutable` cache. Hard-refresh (Cmd/Ctrl+Shift+R) or open a private window. |
| `npm run fetch-images` reports `429` and some images fall back to SVG | Wikimedia rate-limited you. The script backs off and is re-runnable — just run it again; already-downloaded files are skipped. |
| Docker build fails on `npm ci` | Stale lockfiles after editing package.json manually — run `npm install` in `server/` and `client/` locally and rebuild. |
| Docker container crash-loops with `unable to open database file` (`ERR_SQLITE_ERROR`) | The `store-data` volume was created root-owned by an earlier build, and the container runs as the non-root `node` user. Remove the stale volume and rebuild: `docker compose down -v && docker compose up --build`. |
| 401 on every authenticated call after server restart with a new `JWT_SECRET` | Old browser token was signed with the previous secret. Sign out and back in. |

## Security notes for the demo environment

- Mock payments only; card data is validated then discarded (brand + last4 kept).
- Passwords are bcrypt-hashed; JWTs expire after 7 days.
- All inputs are Zod-validated; all SQL is parameterised.
- There are **no intentional vulnerabilities**. If a demo needs exploitable
  endpoints (BOLA, injection, etc.), add them deliberately on a branch.
- The newsletter endpoint, auth endpoints and search are the intended
  bot/abuse demo surfaces; the image endpoint is the intended CDN surface.

## Fastly Bot Management (embedded client challenges)

The storefront integrates Fastly Bot Management **embedded client challenges** on
its critical actions (login, register, add-to-cart, cart, checkout, payment),
with a discreet **"Verified by Fastly Bot Management"** badge that fits the design
and a soft gate that disables the action until the device is verified.

It's **dormant until configured** — local dev, tests and CI are unaffected. Set
`VITE_FASTLY_CHALLENGE_FILE` to the challenge script filename you chose in Fastly
(the `/_fs-ch-1T1wmsGaOgGaSxcX/` prefix is universal and built in) to activate it.
Full setup, the list of edge paths to protect, and the fail-open/Docker build
details are in **[docs/FASTLY-BOT-MANAGEMENT.md](docs/FASTLY-BOT-MANAGEMENT.md)**.

## Attribution & license

- **Code** is released under the MIT License (see [`LICENSE`](LICENSE)).
- **Product photography** in `server/public/products/` is downloaded from
  [Wikimedia Commons](https://commons.wikimedia.org) by `npm run fetch-images`.
  Each file's source URL, author and license are recorded in
  `server/public/products/sources.json`. These images remain under their original
  licenses (various CC / public-domain terms) and are **not** covered by the MIT
  license above. "Parc Fermé" is a fictional brand; all products, drivers, teams,
  prices and provenance are invented for demonstration purposes.
