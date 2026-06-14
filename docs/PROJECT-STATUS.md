# Project status & handoff — Parc Fermé

> Snapshot for picking the project up in a fresh session. Last updated at commit
> `2f15956`. For *how to work in the repo* see [`README.md`](../README.md); for
> the bot-challenge details see [`FASTLY-BOT-MANAGEMENT.md`](FASTLY-BOT-MANAGEMENT.md).

## What this is

**Parc Fermé** — a flagship, design-forward, **API-first** demo ecommerce store
(fictional Formula 1 memorabilia) built for **security demonstrations**: CDN
caching, WAF, bot management, API discovery, rate limiting, logging, abuse
scenarios. Nothing is real — no real products, payments or personal data.

- **Repo:** https://github.com/purpleax/parc-ferme-shop (public), branch `main`.
- **Current commit:** `2f15956`. Working tree clean, local == origin.
- **Live demo deploy (user-managed, behind Fastly):** https://parcferme.fastlylab.com

## Stack & architecture

- **client/** — React 18 + Vite + TypeScript + Tailwind v4. Dark "carbon + F1-red"
  theme; bundled fonts (Unbounded, Space Grotesk). Interactive hero (canvas speed
  streaks, parallax, 3D-tilt, magnetic buttons, animated counters). Every
  meaningful action calls the REST API.
- **server/** — Node + Express 4 + TypeScript, run with **tsx** (tsx is a runtime
  dependency, not dev — needed in the Docker image). SQLite via the **built-in
  `node:sqlite`** module (no native build; requires Node ≥ 22.5). Zod validation,
  JWT auth (bcrypt), tiered rate limits, `X-Request-Id` tracing, structured JSON
  request logging, Swagger UI at `/api/docs`. ~30 REST endpoints.
- **Payments** are fully mocked (Luhn-checked test cards; card data discarded).
- Single-container Docker (API serves the built client) — added last, works.

## Run / verify

```bash
npm run setup          # install root + server + client deps
npm run seed           # seed SQLite demo data
npm run fetch-images   # (optional) download real F1 photos (Wikimedia); SVG fallback otherwise
npm run dev            # API :4000, storefront :5173
npm test               # 31 server (vitest+supertest) + 2 client tests  ← currently green
npm run typecheck
npm run demo           # end-to-end API smoke script (correctness gate)
npm run simulate       # multi-user traffic generator (API discovery/WAF demos)
npm run spec           # regenerate static server/openapi.json + .yaml
docker compose up --build   # single container on :4000 (needs `--build`)
```

**Requirement:** Node ≥ 22.5 (machine is on v26). **macOS + Docker Desktop** for the
container (must be running).

## Demo credentials & test cards

- Admin: `admin@parcferme.dev` / `Admin123!`
- Customer: `ava@demo.dev` / `Customer123!` (also noah/imani/lucas@demo.dev / `Customer123!`)
- Cards: `4242 4242 4242 4242` succeeds · `4000 0000 0000 0002` declines ·
  `4000 0000 0000 9995` insufficient funds.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/demo.mjs` (`npm run demo`) | End-to-end API correctness smoke test; exits non-zero on unexpected responses. `--flood` shows 429s. |
| `scripts/simulate.mjs` (`npm run simulate`) | Multi-user traffic generator (shoppers + admin) for API-discovery/WAF demos; prints per-endpoint coverage. Node HTTP client — does NOT load the frontend. |
| `scripts/fetch-images.mjs` (`npm run fetch-images`) | One-time downloader of openly-licensed F1 photos from Wikimedia Commons into `server/public/products/`; attribution in `sources.json`. |
| `server/src/spec-cli.ts` (`npm run spec`) | Exports the OpenAPI spec to static `server/openapi.json` + `server/openapi.yaml`. |

## OpenAPI

- Live: `/api/docs` (Swagger UI) and `/api/openapi.json`.
- Static (committed): `server/openapi.json`, `server/openapi.yaml` (regen with `npm run spec`).

## Fastly Bot Management — embedded client challenge (the active work area)

Integrated on critical actions (login, register, add-to-cart, cart, checkout,
payment): loads Fastly's challenge script, shows a discreet **"Verified by Fastly
Bot Management"** badge, and **soft-gates** the action until verified. Full detail:
[`FASTLY-BOT-MANAGEMENT.md`](FASTLY-BOT-MANAGEMENT.md).

**Config (build-time, Vite — baked in, needs rebuild to change):**
- `VITE_FASTLY_CHALLENGE_FILE` — the **filename** you chose in Fastly (e.g.
  `challenge.js`). The path prefix `/_fs-ch-1T1wmsGaOgGaSxcX/` is **universal across
  all Fastly customers** and is built in, so only the filename is needed.
- `VITE_FASTLY_CHALLENGE_PATH` — full-path override (forgiving of a bare filename;
  always resolved root-absolute).
- `VITE_FASTLY_CHALLENGE_FAILOPEN` — default `true` (release the gate after ~8s if
  the script can't load, so users aren't locked out).
- **Dormant when unconfigured** → no badge, no gating; local dev/CI unaffected.
- Settable via `client/.env`, repo-root `.env` (compose passes it as a build-arg),
  or `--build-arg`.

**Kill switch (commit `2f15956`)** — fully disables the challenge (no `challenge.js`,
no badge, no gating). Three independent triggers:
1. `window.FASTLY_CHALLENGE_DISABLED = true` — runtime, global; inject at the Fastly
   edge via VCL to kill it for everyone instantly, **no rebuild**.
2. `VITE_FASTLY_CHALLENGE_DISABLED=true` — build-time hard off.
3. `?fastlychallenge=off` in any page URL — per-browser, persisted to localStorage;
   `?fastlychallenge=on` re-enables. **No rebuild.**

## ⚠️ Outstanding issue — Firefox blank page behind Fastly

**Symptom:** On the live Fastly site, Safari/Chrome load fine; **Firefox loads then
goes blank.**

**Diagnosis (from the user's HAR + live inspection):**
- `challenge.js` loads (200). Then `POST /_fs-ch-.../pat?token=…` → **401** (Private
  Access Token / Apple Privacy Pass — expected to fail on Firefox), so it falls back
  to a **Proof-of-Work** challenge, and `POST /_fs-ch-.../fst-post-back` (the PoW
  answer) → **400**. The challenge cannot complete on Firefox.
- On Chrome the challenge sits at `captcha_prompted` but the app stays up.

**What we fixed (commits `cb8b320`, `a35ad65`, `2f15956`):**
- Decoupled the `.fastly-challenge` DOM node from React (built imperatively, appended
  to `<body>`) so a third-party DOM mutation can't crash React and blank the SPA.
  Verified in-browser: mutating/injecting/removing the node + forced re-renders no
  longer crashes the app.
- Added an app-wide **ErrorBoundary** (branded fallback instead of white screen).
- Fixed the script URL ever resolving page-relative (`/product/challenge.js`).
- Added the **kill switch** so the challenge can be turned off without being blocked
  by the Fastly-side problem.

**Still open / NOT fixed in this repo (Fastly-side):**
- The **PoW `400` on Firefox** is inside Fastly's edge/challenge solver — not
  controllable from app code. Until Fastly resolves it, Firefox users can't actually
  *pass* the challenge. With fail-open (default) the page stays usable; the badge
  shows "unavailable."
- **Unverified:** the user reported the blank persisted even after deploying the
  decouple fix (`cb8b320` is confirmed live in the bundle). The blank may therefore
  be Fastly's challenge script taking over / clearing the page on Firefox's failure,
  which the app can't fully prevent. **Not yet reproduced live in Firefox by us**
  (computer-use can screenshot Firefox but can't drive its devtools).

**Recommended next steps:**
1. Fastest mitigation: inject `window.FASTLY_CHALLENGE_DISABLED = true` at the Fastly
   edge (VCL) to stop Firefox blanking immediately, or set
   `VITE_FASTLY_CHALLENGE_DISABLED=true` and rebuild.
2. Raise the Firefox PoW `400` with Fastly (check whether the embedded challenge is
   configured as blocking vs non-blocking; test a fresh Firefox profile / lowered
   anti-fingerprinting).
3. To reproduce live: open `https://parcferme.fastlylab.com` in Firefox and capture
   the console + whether `document.body`/`#root` is wiped at the moment it blanks.

## Gotchas / non-obvious facts

- **`node:sqlite`, not better-sqlite3** — the machine's Node has no better-sqlite3
  prebuilds and source builds fail; the built-in module needs Node ≥ 22.5. Vitest
  must be ≥ 3 (v2's bundled Vite can't resolve `node:sqlite`).
- **tsx is a runtime dependency** (Docker runs `npm ci --omit=dev` then `npx tsx`).
- **Docker volume permissions:** the container runs as non-root `node`; the
  Dockerfile `mkdir`+`chown`s `server/data` and `server/logs` so the named volume is
  writable. A stale root-owned volume from an old build needs `docker compose down -v`.
- **VITE_* vars are build-time** — changing the challenge config requires a rebuild
  (`--build`), not a container restart.
- **The simulator never loads the frontend** — it's a Node HTTP client, so the
  frontend kill switch doesn't apply to it. To exempt simulated traffic from Fastly's
  challenge, exempt it at the edge by User-Agent or a header (not an app query param).
- Client localStorage has an in-memory fallback (tests/jsdom).
- Product photography is third-party (Wikimedia Commons, various licenses; see
  `server/public/products/sources.json`); code is MIT (`LICENSE`).

## Doc map

- [`README.md`](../README.md) — setup, run, API table, curl examples, troubleshooting.
- [`docs/FASTLY-BOT-MANAGEMENT.md`](FASTLY-BOT-MANAGEMENT.md) — challenge integration, config, kill switch, edge setup.
- `server/openapi.json` / `.yaml` — importable API spec.
