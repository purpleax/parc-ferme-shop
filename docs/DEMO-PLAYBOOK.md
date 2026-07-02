# Demo playbook — Parc Fermé × Fastly

How to actually *run* each demo this store supports: what it proves, the exact
commands/clicks, what to show on the Fastly side, and the talk track. **Part A** is
everything built and runnable today. **Part B** is the roadmap — how each planned
feature will be demoed once built (design detail lives in
[DEMO-ENHANCEMENTS.md](DEMO-ENHANCEMENTS.md)).

Companion docs: [README.md](../README.md) (setup, API, curl), [PROJECT-STATUS.md](PROJECT-STATUS.md)
(current state), [FASTLY-BOT-MANAGEMENT.md](FASTLY-BOT-MANAGEMENT.md) (challenge/ACSD config).

---

## The two demo engines

Almost every demo is driven by one of two things:

1. **The storefront** (`http://localhost:5173` in dev, or the live Fastly site) — a real
   browser, so it exercises client-side features: Bot Management challenges, ACSD, the
   honeypot link, CDN caching of pages/images.
2. **The traffic simulator** (`npm run simulate`) — a Node HTTP client that generates
   lifelike multi-user API traffic (shoppers + admin + scraper). It **never loads the
   frontend**, so it's your bot/attacker/volume generator for WAF, API-discovery and
   rate-limit demos. See the flag table in the [appendix](#appendix--cheat-sheet).

**Where to run:** local (`npm run dev`) proves the origin behaviour; a deploy **behind
your Fastly service** (point the edge at the origin on `:4000`) is what makes the Fastly
signals, rules and dashboards light up. The live reference deploy is
`https://parcferme.fastlylab.com`.

**Showing the Fastly side:** this repo's session has the **Fastly** and **Fastly NGWAF**
MCP servers connected, so during a demo you can either use the Fastly UI **or ask Claude**
to pull the data live, e.g. *"run `ngwaf_get_top_signals`"*, *"run
`api_security_list_discovered_apis`"*, *"summarise threat activity"*. Tool names are noted
per demo.

---

## Quick reference

| # | Demo | Built? | Fastly product | One-liner |
|---|---|---|---|---|
| A1 | CDN caching & cache-hit ratio | ✅ | CDN / caching | Catalogue + images cacheable; per-user responses `private, no-store` |
| A2 | API Discovery | ✅ | API Discovery | Simulator exercises ~30 documented endpoints + undocumented shadow surface |
| A3 | Honeypot bot signal | ✅ | NGWAF / Bot | `/api/special-offers` — no human ever hits it; `X-Trap` header |
| A4 | Embedded client challenges | ✅ | Bot Management | Login/cart/checkout soft-gated behind a device challenge |
| A5 | Advanced Client-Side Detection | ✅ | Bot Management | Passive headless detection sets a cookie → WAF signals |
| A6 | Account-takeover (ATO) signals | ✅ | NGWAF (ATO templates) | `X-Auth-Event` header on every auth response |
| A7 | Password-reset success flood | ✅ | NGWAF (ATO) | `reset_flood.py` generates attempt/success/failure at volume |
| A8 | Rate limiting at the edge | ✅ | NGWAF / rate limiting | App has no limiter; flood the origin, let Fastly throttle |
| A9 | WAF injection & authz basics | ✅ | NGWAF / WAF | Injection payloads at search/inputs; 403 authz boundary |
| A10 | Logging & request tracing | ✅ | Observability / SIEM | JSON access log + `X-Request-Id` end to end |
| A11 | Payment carding (CC-VAL-*) | ✅ | NGWAF templates | `X-Payment-Event` header + `--carding` persona flood the confirm endpoint |
| B1 | Gift-card carding (GC-VAL-*) | ⛔ planned | NGWAF templates | See [roadmap P2](DEMO-ENHANCEMENTS.md) |
| B3 | Limited "drop" bot rush | ⛔ planned | Bot Management | Roadmap P4 |
| B4 | Promo-code brute force | ⛔ planned | NGWAF / rate limit | Roadmap P5 |
| B5 | Review spam / XSS sink | ⛔ planned | WAF | Roadmap P6 |
| B6 | Search-autocomplete velocity | ⛔ planned | Rate limiting | Roadmap P7 |
| B7 | Order-ID enumeration | ⛔ planned | NGWAF / rate limit | Roadmap P8 |
| B8 | Contact-form injection | ⛔ planned | WAF | Roadmap P9 |

---

# Part A — Ready to demo today

Each demo: **Demonstrates · Setup · Run · Show in Fastly · Expected / talk track.**

## A1 · CDN caching & cache-hit ratio

- **Demonstrates:** the CDN serving cacheable content from the edge, and the app correctly
  marking per-user/mutating responses uncacheable so no stale or cross-user data is served.
- **Setup:** deploy behind Fastly (caching only matters at the edge). Local, you can still
  show the response headers that drive it.
- **Run (show the headers):**
  ```bash
  # Cacheable: public catalogue + immutable images
  curl -sI http://localhost:4000/api/products | grep -i cache-control          # (none → cacheable)
  curl -sI http://localhost:4000/api/images/products/monza.svg | grep -i cache-control
  #   → public, max-age=86400, immutable
  # Not cacheable: anything per-user or mutating
  curl -sI http://localhost:4000/api/cart/<id> | grep -i cache-control         # → private, no-store
  ```
  Then browse the storefront and reload pages/images to build hit ratio.
- **Show in Fastly:** the cache-hit ratio on the dashboard, or ask Claude to run
  `fastly_get_cache_summary` / `fastly_get_realtime_stats`.
- **Talk track:** *"Product listings and images are cacheable and immutable — they scale at
  the edge. But carts, orders and anything authenticated send `private, no-store`, so the
  CDN never serves one shopper's cart to another. `private` is deliberate: Fastly's default
  VCL ignores a bare `no-store`, so `private` is what actually prevents the edge caching it."*

## A2 · API Discovery

- **Demonstrates:** Fastly learning the API surface from live traffic — and flagging
  **undocumented** endpoints that aren't in the OpenAPI spec.
- **Setup:** behind Fastly with API Discovery / API Security enabled.
- **Run:**
  ```bash
  npm run simulate -- --users 6 --duration 180
  ```
  The simulator drives ~30 documented endpoints (it prints a coverage report) **and** the
  scraper persona hits the undocumented shadow surface (`/api/v1/orders`,
  `/api/internal/metrics`, `/api/debug/config`).
- **Show in Fastly:** the discovered/inventoried API list, and specifically the *unknown*
  APIs. Ask Claude: *"run `api_security_list_discovered_apis`"* and *"run
  `api_security_find_unknown_apis`"* (also `list_inventoried_apis`, `get_enablement`).
- **Expected / talk track:** the three shadow routes appear as discovered-but-undocumented.
  *"Discovery didn't need our spec — it learned the surface from traffic, then flagged three
  endpoints that exist in production but nobody documented. That's exactly the forgotten
  `/v1/` alias and internal endpoints that leak in real breaches."* You can import
  `server/openapi.json` as the "known" spec to sharpen the known-vs-unknown contrast.

## A3 · Honeypot bot signal

- **Demonstrates:** a near-zero-false-positive bot signal. `/api/special-offers` has **no
  legitimate caller** — it's `Disallow`-ed in `robots.txt` and linked only from a
  visually-hidden footer element. Any hit is automation.
- **Setup:** behind Fastly with NGWAF.
- **Run:**
  ```bash
  npm run simulate            # the scraper persona reads robots.txt and walks the trap
  # or hit it directly:
  curl -sI http://localhost:4000/api/special-offers | grep -i x-trap   # → X-Trap: honeypot
  ```
- **Show in Fastly:** requests to `/api/special-offers` or responses carrying `X-Trap`.
  Ask Claude: *"run `ngwaf_get_top_paths`"* / *"run `ngwaf_list_requests` for
  `/api/special-offers`"* / *"run `get_suspicious_ips`"*.
- **Build the rule (live):** ask Claude to *"dry-run an NGWAF rule that flags requests to
  `/api/special-offers`"* (`ngwaf_dry_run_create_rule`), review, then
  `ngwaf_create_rule_after_approval`.
- **Talk track:** *"No tuning, no thresholds, no false positives — a human physically
  cannot reach this path. One hit = one bot. It's the cheapest high-confidence signal you
  can deploy, and it doubles as bait: bots that scrape `robots.txt` for hidden paths walk
  straight into it."*

## A4 · Bot Management — embedded client challenges

- **Demonstrates:** device verification gating the abuse-prone actions (login, register,
  add-to-cart, checkout, payment) with a visible **"Verified by Fastly Bot Management"**
  badge, enforced at the edge.
- **Setup:** build the client with the challenge filename and serve behind Fastly with
  embedded challenges enabled. See [FASTLY-BOT-MANAGEMENT.md](FASTLY-BOT-MANAGEMENT.md).
  ```bash
  echo 'VITE_FASTLY_CHALLENGE_FILE=challenge.js' > client/.env.local && npm run dev
  ```
- **Run:** in the browser, go to `/login` or a product page — the action button is
  soft-gated until the badge shows *Verified*. Configure the edge to require a valid
  challenge token on the matching POST paths (table in FASTLY-BOT-MANAGEMENT.md §Fastly-side
  setup) so the enforcement is real, not just UX.
- **Show:** the badge lifecycle (*Verifying… → Verified*), and at the edge, requests to a
  protected path **without** a token being rejected. Contrast: `npm run simulate` (no
  browser, no token) is exactly the traffic the edge should block on protected POSTs.
- **Kill switch (for the demo):** `?fastlychallenge=off` on any URL, or edge-inject
  `window.FASTLY_CHALLENGE_DISABLED=true` — turn it off live without a rebuild.
- **Talk track:** *"The storefront badge is UX; enforcement is at the edge via the challenge
  token. Even if someone re-enables the disabled button in devtools, the edge rejects the
  POST without a valid token — and headless traffic like our simulator never gets one."*

## A5 · Bot Management — Advanced Client-Side Detection (ACSD)

- **Demonstrates:** passive headless-browser detection with no user friction — a script
  runs on every page load and sets a `_fs_cd_cp_` cookie that populates WAF signals.
- **Setup:**
  ```bash
  echo 'VITE_FASTLY_ACSD_FILE=script.js' >> client/.env.local && npm run dev
  ```
  (built into `<head>`; behind Fastly with Bot Management.)
- **Run:** load the site in a normal browser, then in a headless one (or a headless-Chrome
  tool) and compare.
- **Show in Fastly:** the signals `SUSPECTED-BOT.HEADLESS`, `SUSPECTED-BAD-BOT.HEADLESS`,
  `CLIENTSIDE-COOKIE-VALID`. Ask Claude: *"run `ngwaf_get_top_signals`"*.
- **Talk track:** *"No badge, no challenge, zero friction for real users — the page just
  quietly tells the edge whether the client looks automated. Great first layer before you
  reach for an interactive challenge."*

## A6 · Account-takeover (ATO) signals via `X-Auth-Event`

- **Demonstrates:** the origin telling the edge the **outcome** of every auth attempt, so
  NGWAF's templated ATO rules (login/registration/reset) key off truth, not guesses.
- **Setup:** behind Fastly NGWAF with the ATO templated rules enabled.
- **Run:**
  ```bash
  # Credential-stuffing shape: many logins, mostly failures
  npm run simulate -- --users 8 --duration 120
  # or by hand — watch the header flip:
  curl -sI -X POST http://localhost:4000/api/auth/login \
    -H 'content-type: application/json' -d '{"email":"ava@demo.dev","password":"wrong"}' \
    | grep -i x-auth-event      # → login-failure
  ```
  The header values are `login-success|failure`, `register-success|failure`, and
  `password-reset-attempt|success|failure`.
- **Show in Fastly:** ATO signals (`LOGINATTEMPT`, `LOGINFAILURE`, `LOGINSUCCESS`, plus
  registration/reset equivalents). Ask Claude: *"run `ngwaf_get_top_signals`"* /
  *"summarise threat activity"* (`ngwaf_summarise_threat_activity`).
- **Talk track:** *"The edge can't always tell a successful login from a failed one — the
  origin can. One header per response maps 1:1 to a templated signal, so you get a clean
  failure-rate spike per source IP during credential stuffing, and a success spike is your
  ATO alarm."*

## A7 · Password-reset success flood

- **Demonstrates:** generating a realistic mix of reset **attempt / success / failure** at
  volume — including the hard-to-fake *success* signal — for the ATO dashboard.
- **Setup:** set `RESET_TEST_DOMAIN` on the server so `forgot-password` returns the token in
  its response **for that domain only** (safe on a public origin — real accounts never leak
  a token):
  ```bash
  RESET_TEST_DOMAIN=resettest.dev npm run dev:api
  ```
- **Run:**
  ```bash
  python3 scripts/reset_flood.py --base http://localhost:4000 \
      --domain resettest.dev --count 100 --fail-rate 0.25
  ```
- **Show in Fastly:** the reset-attempt/success/failure signals rising together; the
  success line is the one that matters for ATO. Ask Claude to summarise NGWAF events.
- **Talk track:** *"Attempts and failures are easy to simulate; a real reset **success**
  needs a valid single-use token, which normally only appears in server logs. The test
  domain hands it back so you can light up the whole funnel — and only for a throwaway
  domain, so it's safe to run against a live origin."*

## A8 · Rate limiting at the edge

- **Demonstrates:** the origin does **no** rate limiting on purpose — so you can show
  Fastly absorbing a flood and throttling it at the edge, keeping the origin clean.
- **Setup:** behind Fastly with a rate-limiting rule (e.g. on `/api/newsletter` or auth
  paths). The newsletter endpoint is a deliberate bot-attractive target.
- **Run:**
  ```bash
  npm run simulate -- --users 12 --duration 120 --delay 0-50    # high-volume, low think-time
  ```
- **Show in Fastly:** 429s / blocks at the edge and request-rate per source IP. Ask Claude:
  *"run `ngwaf_get_top_source_ips`"* / *"run `ddos_summarise_attack_activity`"* /
  *"run `fastly_get_realtime_stats`"*.
- **Talk track:** *"There's no app-side limiter to muddy the picture — the origin will
  happily serve everything. That makes it a clean canvas: every 429 you see is the edge
  doing its job, and the origin's request rate stays flat while the edge sheds the flood."*

## A9 · WAF injection & authorization basics

- **Demonstrates:** injection payloads hitting realistic inputs, plus a clean authz
  boundary and structured validation errors (no stack traces leaked).
- **Setup:** behind Fastly NGWAF with WAF signals on.
- **Run:**
  ```bash
  # Injection probes at the search input (add a contact form later, roadmap B8)
  curl -s "http://localhost:4000/api/products?search=%27%20OR%201=1--"
  curl -s "http://localhost:4000/api/products?search=<script>alert(1)</script>"
  # Authorization boundary: customer token on an admin route → 403
  curl -sI http://localhost:4000/api/admin/stats -H "Authorization: Bearer <customer-jwt>"
  # Forged/none-alg tokens are rejected (see server tests) → 401
  ```
- **Show in Fastly:** SQLi/XSS WAF signals, and the request inspector for the payloads. Ask
  Claude: *"run `ngwaf_get_top_signals`"* / *"run `ngwaf_list_requests`"*.
- **Talk track:** *"The app validates and returns a structured 400 — no stack traces, no SQL
  errors leaked (queries are parameterised) — so the WAF is your outer layer catching the
  probe before it ever reaches origin logic. And the authz boundary is real: a customer
  token gets a 403 on admin routes, a forged token a 401."* (Roadmap B5/B8 add UGC + a
  contact form as richer injection sinks.)

## A10 · Logging, request tracing & SIEM feed

- **Demonstrates:** end-to-end traceability — every API request is a structured JSON log
  line, and `X-Request-Id` ties a browser response to that line (and propagates an
  edge-injected id).
- **Setup:** none (local is fine).
- **Run:**
  ```bash
  tail -f server/logs/api.log        # then click around the storefront or run the simulator
  curl -sI http://localhost:4000/api/health | grep -i x-request-id
  # Edge-injected id propagates; malformed ids are replaced (not echoed):
  curl -sI http://localhost:4000/api/health -H 'X-Request-Id: trace-abc123' | grep -i x-request-id
  ```
- **Show:** each log line has `ts, requestId, method, path, status, durationMs, ip, userId,
  role, authEvent, userAgent` — ready to ship to a SIEM. Correlate a Fastly log entry's
  request id with the origin line.
- **Talk track:** *"One id from edge to origin to log line. The access log already carries
  the auth outcome and role, so a SIEM can build the ATO / abuse view without parsing bodies
  — and a malformed inbound id is regenerated, so nobody can inject junk into your logs."*

## A11 · Payment carding (card-testing / CC-VAL-*)

- **Demonstrates:** card-testing detection — a stream of card validations from one source,
  mostly failing with the occasional success, which is the tell that stolen card numbers
  are being checked against your payment flow.
- **Setup:** behind Fastly NGWAF with the card-testing (CC-VAL) templated rules enabled.
- **Run:**
  ```bash
  npm run simulate -- --carding --duration 120
  # or watch the header flip by hand:
  curl -sI -X POST http://localhost:4000/api/payments/intent \
    -H "authorization: Bearer <jwt>" -H 'content-type: application/json' \
    -d '{"orderId":"PF-XXXXXX"}' | grep -i x-payment-event      # → payment-attempt
  #   confirm with 4000000000000002 → payment-failure ; with 4242… → payment-success
  ```
  The `--carding` persona stands up one pending order and floods
  `POST /api/payments/{id}/confirm` with rotating numbers — mostly the decline cards and
  random invalid numbers, the odd good card — so the order stays pending between failures
  exactly like real carding.
- **Show in Fastly:** CC-VAL signals (`CC-VAL-ATTEMPT`, `CC-VAL-FAILURE`, `CC-VAL-SUCCESS`)
  and the confirm-failure rate per source IP. Ask Claude: *"run `ngwaf_get_top_signals`"* /
  *"summarise threat activity"*.
- **Talk track:** *"The origin tells the edge the outcome of every card check — `payment-attempt`
  on intent, then success or failure on confirm. A carder generates a burst of failures from
  one IP with a rare success; that success is the alarm, because it means a live card was
  found. One header, 1:1 with the templated CC-VAL signals — same pattern as the auth ATO
  signals."* (Gift-card carding, roadmap B1/P2, adds the `GC-VAL-*` equivalent.)

---

# Part B — Roadmap demos (planned, not yet built)

Design detail (endpoints, headers, personas, effort) is in
[DEMO-ENHANCEMENTS.md](DEMO-ENHANCEMENTS.md). Each will follow the same recipe as the built
demos: an origin-emitted `X-<Domain>-Event` outcome header + a matching simulator persona +
the Fastly control it feeds. Sketch of the eventual demo for each:

| Roadmap | Demo once built | Fastly control | Simulator persona |
|---|---|---|---|
| **P2 · Gift cards** | Brute-force gift-card balance checks → `X-Giftcard-Event` failure spike | NGWAF templated `GC-VAL-ATTEMPT/FAILURE/SUCCESS` | `GiftcardBruteforce` |
| ~~P3 · Payment carding~~ | ✅ shipped — see [A11](#a11--payment-carding-card-testing--cc-val-) | NGWAF templated `CC-VAL-*` | `CardFlood` |
| **P4 · Limited drop** | Bot rush at drop time vs. a real buyer getting through the challenge | Bot Management challenge | `DropBot` |
| **P5 · Promo codes** | High-cardinality code guessing → `X-Promo-Event` failures | Rate limiting / ATO-style | `PromoBrute` |
| **P6 · Reviews (UGC)** | XSS/SQLi payloads + spam posted to review fields | WAF injection + content-spam | `ReviewSpam` |
| **P7 · Search suggest** | Keystroke-rate autocomplete flood | Rate limiting / velocity | (extend shopper) |
| **P8 · Order tracking** | Sequential order-ID enumeration → 404 burst | NGWAF / rate limit | `Enumerator` |
| **P9 · Contact form** | Injection payloads at free-text fields | WAF injection | `attacker` |

**Suggested build order** (from the roadmap): P1 ✅ → P3 ✅ → P2 (next) → P4 → the rest per
demo. When one ships, move its row up into Part A with the concrete commands.

---

# Appendix — cheat sheet

**Credentials (dev/test only):** admin `admin@parcferme.dev` / `Admin123!` · customers
`ava|noah|imani|lucas@demo.dev` / `Customer123!`. **Cards:** `4242…4242` ok ·
`4000…0002` declined · `4000…9995` insufficient funds. *(None work in production — the
admin password comes from `ADMIN_PASSWORD` or is random-generated on first seed.)*

**Simulator flags** (`npm run simulate -- <flags>`):

| Flag | Default | Purpose |
|---|---|---|
| `--users N` | 3 | Concurrent shopper sessions |
| `--duration S` | 60 | Run seconds (ignored if `--loops`) |
| `--loops N` | — | N sessions per user, then exit |
| `--delay MIN-MAX` | 500-2000 | Think-time ms (use `0-50` for floods) |
| `--base URL` | `$API_URL` or localhost:4000 | Target (point at the Fastly host for a live demo) |
| `--no-admin` | off | Skip the admin persona |
| `--no-scraper` | off | Skip the scraper/honeypot persona |
| `--carding` | off | Add the card-testing persona (A11 / CC-VAL demo) |
| `--verbose` / `--quiet` | off | Per-request lines / suppress status line |

**Key env vars:** `RESET_TEST_DOMAIN` (A7), `VITE_FASTLY_CHALLENGE_FILE` (A4),
`VITE_FASTLY_ACSD_FILE` (A5), `VITE_FASTLY_CHALLENGE_DISABLED` (kill switch). Full table in
[README §6](../README.md) and [FASTLY-BOT-MANAGEMENT.md](FASTLY-BOT-MANAGEMENT.md).

**Point the simulator/scripts at the live edge:** add `--base https://parcferme.fastlylab.com`
(simulator) or `--base https://…` (`reset_flood.py`) so the traffic traverses Fastly.

**Reset to clean demo data:** `npm run seed` (local) or `docker compose down -v && docker
compose up` (container).

**Fastly MCP tools to reach for during a demo** (ask Claude to run them): API discovery —
`api_security_list_discovered_apis`, `api_security_find_unknown_apis`; NGWAF —
`ngwaf_get_top_signals`, `ngwaf_get_top_paths`, `ngwaf_get_top_source_ips`,
`ngwaf_list_requests`, `ngwaf_summarise_threat_activity`, `ngwaf_dry_run_create_rule` →
`ngwaf_create_rule_after_approval`; caching/traffic — `fastly_get_cache_summary`,
`fastly_get_realtime_stats`; DDoS — `ddos_summarise_attack_activity`.
