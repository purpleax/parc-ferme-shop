# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Parc Fermé** — an API-first demo ecommerce store (fictional Formula 1 memorabilia)
built for security demonstrations (CDN, WAF, bot management, API discovery, rate
limiting, logging). npm-workspaces-style monorepo: `server/` (Express API) + `client/`
(React SPA), with shared scripts in `scripts/`. Deployed as a single Docker container
(API serves the built client). See `docs/PROJECT-STATUS.md` for current state and open
issues, `README.md` for the full guide.

## Commands

Run from the repo root unless noted. Each app is its own npm package; root scripts fan
out with `--prefix`.

```bash
npm run setup            # install root + server + client deps
npm run seed             # seed SQLite demo data (required before first run)
npm run dev              # API :4000 + Vite client :5173 (concurrently)
npm run dev:api          # API only       npm run dev:web   # client only
npm test                 # server (vitest+supertest) + client tests
npm run typecheck        # tsc on both
npm run build            # build the client (client/dist)
npm run demo             # end-to-end API smoke test against a RUNNING server (--flood for 429s)
npm run simulate         # multi-user traffic generator (API-discovery/WAF demos)
npm run spec             # regenerate static server/openapi.json + .yaml from openapi.ts
npm run fetch-images     # one-time: download F1 photos (Wikimedia); SVG fallback otherwise
docker compose up --build  # single container on :4000 (needs --build; see Docker notes)
```

Run a **single server test**: `cd server && npx vitest run -t "substring of test name"`
(or pass a file path). The server suite uses an **in-memory DB** (`DATABASE_PATH=:memory:`,
set in `test/api.test.ts`) and needs no running server. `npm run demo`/`npm run simulate`
do require a running server (`API_URL` env overrides the base URL).

## Hard requirements / environment

- **Node ≥ 22.5** — the DB layer uses the built-in `node:sqlite` module (see below).
- SQLite DB and request log are created at runtime under `server/data/` and `server/logs/`
  (gitignored). `npm run seed` resets to pristine demo data.
- Demo accounts (**dev/test only**): admin `admin@parcferme.dev` / `Admin123!`, customer
  `ava@demo.dev` / `Customer123!`. Test cards: `4242…4242` succeeds, `4000…0002` declines,
  `4000…9995` insufficient funds.
- **Production secrets**: `JWT_SECRET` is **required** in production (`NODE_ENV=production`) —
  the app refuses to boot without a unique 32+ char value (repo defaults are blocklisted), and
  JWTs are pinned to `HS256`. The seeded admin password comes from `ADMIN_PASSWORD`, or is
  randomly generated and logged once. `Admin123!`/`Customer123!` never apply in production.

## Architecture (the big picture)

**Server (`server/src/`)** — Express 4 + TypeScript, run directly with **tsx** (no build
step). Request pipeline in `app.ts`: `requestId` (adds `X-Request-Id` + security headers)
→ `attachUser` (decodes JWT if present) → `requestLogger` (JSON line per `/api` request to
console + `logs/api.log`) → route-specific limiters → routers → `apiNotFound` → static
client (`client/dist` if present) → `errorHandler`. All errors flow through `ApiError`
(`errors.ts`) into one envelope: `{ error: { code, message, details?, requestId } }`.

- **`db.ts`** wraps `node:sqlite`'s `DatabaseSync` in a thin `Db` class with a
  better-sqlite3-style `.prepare()/.transaction()` API and runs the schema migration on
  import. Rows are typed at call sites (statements return loose types). Money is stored as
  integer cents everywhere.
- **`middleware.ts`** owns auth (`signToken`/`requireAuth`/`requireAdmin`), Zod validation
  (`parse(schema, data)` throws `ApiError` 400 with field details), rate limiters
  (general / auth / newsletter tiers), the logger, and `asyncHandler` (Express 4 does not
  forward async rejections — async routes must be wrapped; only payment-confirm is async).
- **Routes** (`routes/`): `auth` (register/login/me + password reset via
  `forgot-password`/`reset-password`; single-use hashed tokens in
  `password_reset_tokens`, 30-min expiry, no email — the link is logged. Every auth
  response sets an **`X-Auth-Event`** header — `login|register|password-reset` ×
  `attempt|success|failure` — for Fastly NGWAF ATO templated rules), `catalog` (products/categories/search/filter/sort/
  paginate), `images` (serves `server/public/products/*.jpg` real photos, falls back to a
  deterministic generated SVG; both `Cache-Control: max-age=86400, immutable`), `cart`,
  `orders` (orders + mock payments: Luhn check, derive brand/last4, **discard card**,
  decrement stock, clear cart), `admin` (stats, product CRUD with soft-delete, order
  management, customers), `misc` (health, newsletter). `helpers.ts` has `mapProduct`,
  `imageUrl` (decides jpg vs svg), `PRODUCT_SELECT`, id/slug helpers.
- **`openapi.ts`** is the hand-maintained OpenAPI 3.0.3 spec (source of truth), served at
  `/api/docs` (Swagger UI) and `/api/openapi.json`; `spec-cli.ts` exports it to static
  `server/openapi.json`/`.yaml` (run `npm run spec` after editing).
- **`seed.ts`** holds the entire demo catalogue/users/orders and the `DEMO_ACCOUNTS`.
  `index.ts` auto-seeds on first run when the products table is empty.

**Client (`client/src/`)** — React 18 + Vite + TS + Tailwind v4. `lib/api.ts` is the
single fetch wrapper (injects JWT from `lib/storage.ts`, throws typed `ApiError`).
State lives in React contexts: `AuthContext`, `CartContext` (anonymous cart id in
storage), `ToastContext`, `FastlyChallengeContext`. `App.tsx` wraps everything in an
`ErrorBoundary`. Pages under `pages/` (+ `pages/admin/`); the interactive hero effects
are in `components/fx.tsx`. The Vite dev server proxies `/api` → `:4000`.

## Fastly Bot Management (active feature — read `docs/FASTLY-BOT-MANAGEMENT.md`)

Embedded client-challenge integration gating critical actions (login, register,
add-to-cart, cart, checkout, payment) with a discreet "Verified by Fastly Bot
Management" badge. Key facts that bite if missed:

- **Build-time config (Vite `VITE_*`, baked in — rebuild to change):**
  `VITE_FASTLY_CHALLENGE_FILE` is normally all you set (just the **filename**; the prefix
  `/_fs-ch-1T1wmsGaOgGaSxcX/` is universal across all Fastly customers and is built into
  `lib/fastlyChallenge.ts`). Dormant when unset. `resolveChallengePath()` always returns a
  root-absolute URL (never page-relative).
- **The challenge DOM node is created imperatively and appended to `<body>`, outside
  React's tree** (`FastlyChallengeContext`). This is deliberate — the Fastly script mutates/
  replaces that node, and rendering it via JSX crashed React and blanked the SPA on Firefox.
  Do not move it back into the React tree.
- **Kill switch** (any one disables it fully): `window.FASTLY_CHALLENGE_DISABLED = true`
  (runtime/global, edge-injectable), `VITE_FASTLY_CHALLENGE_DISABLED=true` (build-time),
  or `?fastlychallenge=off` URL param (per-browser, persisted).
- The traffic simulator (`scripts/simulate.mjs`) is a Node HTTP client and **never loads
  the frontend**, so none of the above affects it.

## Gotchas

- **`node:sqlite`, not better-sqlite3** — better-sqlite3 has no prebuilds for the target
  Node and source-builds fail; the built-in module needs Node ≥ 22.5. Consequently **vitest
  must stay ≥ 3** (v2's bundled Vite can't resolve the `node:sqlite` import).
- **`tsx` is a runtime dependency** (in `server` `dependencies`, not dev) — the Docker
  image runs `npm ci --omit=dev` then `npx tsx src/index.ts`.
- **Docker**: container runs as non-root `node`; the Dockerfile `mkdir`+`chown`s
  `server/data` and `server/logs` so the named volume is writable. A stale root-owned
  volume from an older build must be removed with `docker compose down -v`. `VITE_*`
  challenge config is passed via build-args (or `client/.env`, copied into the build) — it
  is baked at build time, so changing it needs `--build`.
- Commit messages in this repo end with a `Co-Authored-By: Claude …` trailer; pushes go to
  `origin/main` (https://github.com/purpleax/parc-ferme-shop).
- Product photos under `server/public/products/` are third-party (Wikimedia Commons,
  various licenses — see `sources.json`); code is MIT.
