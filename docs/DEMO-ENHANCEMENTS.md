# Demo enhancements — roadmap

Prioritised backlog of features that make Parc Fermé feel like a real store **and**
give Fastly WAF / Bot Management / API Discovery something concrete to catch. No code
has been written yet — this is the design doc to pick from per demo.

Realism bar for all targets: **realistic but clearly fictional** — plausible endpoints
and in-character copy, obviously fake F1 memorabilia, nothing that reads as a real
gift-card or phishing kit.

## The recipe (why these are turnkey, not just features)

The app already established a pattern worth reusing for every security-relevant feature:

1. **An outcome header** — `X-Auth-Event: login-success|failure|…` today. Edge rules key
   off the *origin's verdict* instead of guessing from the request. Extend with
   `X-Giftcard-Event`, `X-Payment-Event`, `X-Promo-Event`, etc. (one header, one value
   per response, 1:1 with a Fastly templated signal).
2. **A matching simulator persona** — a new class in [scripts/simulate.mjs](../scripts/simulate.mjs)
   alongside `Shopper`/`Admin`, added to the `actors` array, so the traffic shape exists
   on demand.
3. **A coverage entry** — add the endpoint to the `CANONICAL` list (or a new `SHADOW`
   list, see item 1 below) so the simulator's coverage report tracks it.
4. **The Fastly control it demonstrates** — named per feature below.

Keep every new response header on the `X-<Domain>-Event` convention so one NGWAF
templated-signal mapping covers them all.

---

## Priority 1 — Honeypot + shadow APIs  ⭐ build first

**Why first:** cheapest to build, no new UI to speak of, and it demonstrates two distinct
Fastly capabilities (API Discovery + a near-zero-false-positive bot signal). Right now the
OpenAPI spec *is* the source of truth for every route, so API Discovery has nothing to
find — this deliberately creates undocumented surface.

### Components

**A. `robots.txt` as bait** — new file `client/public/robots.txt` (Vite copies
`client/public/*` into `client/dist`, which the API serves as static in prod).
Allow the real pages, `Disallow` the honeypot path. Well-behaved crawlers obey it;
scrapers that *read* robots.txt to discover "hidden" paths will walk straight into the trap.

```
User-agent: *
Allow: /
Disallow: /vault
Disallow: /api/special-offers
```

**B. An invisible honeypot link** — an `aria-hidden`, visually-hidden `<a href="/vault">`
in the footer ([client/src/components/Layout.tsx](../client/src/components/Layout.tsx)).
Real users never see it (off-screen + `aria-hidden` keeps it out of the a11y tree);
link-following headless bots do. Use an off-screen class, not `display:none` (some bots
skip `display:none`).

**C. The honeypot endpoint** — `GET /api/special-offers`, a new tiny router mounted in
[server/src/app.ts](../server/src/app.ts) **before** `apiNotFound`. Returns `200` with
plausible-but-fake JSON (so a bot keeps engaging), sets a distinctive marker header
(`X-Trap: honeypot`) and logs a distinctive line. **Any** hit is a bot with ~100%
confidence. Deliberately **excluded from `openapi.ts`**.

**D. Shadow / undocumented endpoints** — real routes, deliberately kept out of
`openapi.ts`, that look like forgotten surface:
- `GET /api/v1/orders` — "legacy" alias returning `{ deprecated: true, use: "/api/orders" }`
- `GET /api/internal/metrics` — internal-looking counters (request totals, uptime — same
  data as `/health`, dressed up)
- `GET /api/debug/config` — juicy-looking but returns only non-sensitive, clearly-fake values

These generate real traffic (logged by `requestLogger`) but never appear in the spec →
Fastly API Discovery flags them as unknown/undocumented.

### Simulator changes

- Add a `SHADOW` endpoint list next to `CANONICAL` so the coverage report shows shadow
  surface separately (don't pollute the "documented endpoints" percentage).
- New `Scraper` persona: fetches `/robots.txt`, follows the honeypot link, hammers the
  shadow endpoints and the catalogue. This is your discovery + honeypot traffic generator.

### Fastly demo

- **API Discovery:** `mcp__fastly__api_security_list_discovered_apis` /
  `mcp__fastly__api_security_find_unknown_apis` surface `/api/v1/orders`,
  `/api/internal/metrics`, `/api/debug/config` after the `Scraper` runs.
- **NGWAF:** a custom signal + rule on the honeypot (`req.path == /api/special-offers`
  **or** presence of the `X-Trap` response header) → block/flag the source IP. High
  confidence, zero legitimate traffic.

**Effort:** S (≈ one router file, one static file, one footer link, one persona).
**Risk:** low — additive, no changes to existing routes.

---

## Priority 2 — Gift cards (carding target)

Classic carding / balance-enumeration target, and Fastly NGWAF ships **templated** rules
for it (`GC-VAL-ATTEMPT` / `GC-VAL-FAILURE` / `GC-VAL-SUCCESS`) — see the
`fastly-agent-toolkit:fastly-ngwaf` audit skill.

- **Data:** `gift_cards` table (`code`, `balance_cents`, `active`), seeded with a handful.
- **Endpoints:**
  - `POST /api/gift-cards/check` `{ code }` → balance or 404; sets
    `X-Giftcard-Event: check-attempt` always, plus `-success` / `-failure`.
  - `POST /api/gift-cards/redeem` (auth) applies balance to an order.
- **Authenticity:** sell them in the shop — "Parc Fermé Gift Card · the gift of pole
  position." Redeemable at checkout.
- **Simulator:** `GiftcardBruteforce` persona rotating plausible-format codes → mostly
  `check-failure`, occasional `-success`.
- **Fastly:** NGWAF templated GC-VAL-* rules; velocity of `check-failure` from one source.

**Effort:** M. **Risk:** low (keep codes obviously fake format, e.g. `PF-GIFT-XXXX-XXXX`).

---

## Priority 3 — Payment carding signals (CC-VAL-*)  ✅ SHIPPED

Reused the **existing** mock-payment flow — a header + a persona, no new UI.

- **Done:** `X-Payment-Event` header — `payment-attempt` on `POST /api/payments/intent`,
  `payment-success` / `payment-failure` on `POST /api/payments/:id/confirm`
  ([server/src/routes/orders.ts](../server/src/routes/orders.ts)); documented in the
  OpenAPI spec.
- **Done:** `CardFlood` simulator persona (`npm run simulate -- --carding`) — stands up one
  pending order and floods confirm with rotating card numbers (mostly declines + invalid,
  the odd success), leaving the order pending between failures the way real carding does.
- **Fastly:** NGWAF templated `CC-VAL-ATTEMPT/FAILURE/SUCCESS`; card-testing detection.
- **Demo it:** [DEMO-PLAYBOOK.md → A11](DEMO-PLAYBOOK.md).

---

## Priority 4 — Limited "drop" (bot-management showcase)

The most visceral Bot Management story and very on-brand for F1 memorabilia.

- **Data:** product flags `is_drop`, `drop_at` (timestamp), `drop_stock`, per-customer limit.
- **Endpoints:** `GET /api/drops` (upcoming/live), plus enforce the per-customer limit in
  the order path. Add-to-cart for drops is **already** gated by the Fastly challenge
  integration — this feature gives that gate a reason to exist.
- **UI:** a drop page with a live countdown ("Signed Senna helmet replica · 50 units ·
  drops Sat 14:00 UTC") and a stock-remaining ticker.
- **Simulator:** `DropBot` persona that camps the drop and floods add-to-cart at `drop_at`.
- **Fastly:** Bot Management challenge holds the line while real users check out — the
  demo is "watch the bot bounce off the challenge, watch the human get through."

**Effort:** M–L (countdown + drop page are real UI). **Risk:** low.

---

## Priority 5 — Promo codes (code brute-forcing)

- **Endpoint:** `POST /api/checkout/promo` `{ code }` → discount or invalid;
  `X-Promo-Event: attempt|success|failure`. Codes like `PITSTOP10`, `BOXBOX`, `DRS15`.
- **Simulator:** `PromoBrute` persona guessing high-cardinality codes.
- **Fastly:** rate-limiting / ATO-style rule on `promo-failure` velocity.

**Effort:** S–M. **Risk:** low.

---

## Priority 6 — Product reviews (UGC → XSS/SQLi target)

- **Data:** `reviews` table; `GET /api/products/:slug/reviews`,
  `POST /api/products/:slug/reviews` (auth). Seed in-character reviews
  ("arrived faster than a Red Bull pit stop — 10/10").
- **Why it's a target:** free-text fields are where XSS/SQLi probes naturally land — gives
  the WAF a realistic injection surface beyond search.
- **Simulator:** `ReviewSpam` persona posting spam + injection payloads.
- **Fastly:** WAF XSS/SQLi signals; content-spam velocity.

**Effort:** M. **Risk:** low **if** output is escaped (it will be — React escapes by
default; don't add `dangerouslySetInnerHTML`).

---

## Priority 7 — Search autocomplete (request-velocity / rate-limit)

- **Endpoint:** `GET /api/search/suggest?q=` over the existing search — cheap, and fires on
  every keystroke, so it's naturally the highest-volume endpoint.
- **UI:** debounced suggestions in the header search box (real users debounce; bots don't).
- **Fastly:** rate-limiting and anomalous request-velocity detection have an obvious home.

**Effort:** S–M. **Risk:** low.

---

## Priority 8 — Order tracking (enumeration / IDOR)

- **Endpoint:** `GET /api/track/:orderId` — **public**, returns status + destination city
  only, **no PII**. Order IDs are already short and guessable (`PF-XXXXXX`) — lean into it
  *here*, on a low-stakes endpoint.
- **Simulator:** `Enumerator` persona walking sequential/guessed IDs → burst of 404s.
- **Fastly:** velocity of 404s / enumeration pattern → rate-limit or block.

**Effort:** S. **Risk:** low (no PII exposed — that's the point).

---

## Priority 9 — Contact form (injection payload sink)

- **Endpoint:** `POST /api/contact` with free-text fields.
- **Simulator:** the `attacker` persona aims SQLi/XSS payloads here as well as at search.
- **Fastly:** WAF injection signals on a realistic form.

**Effort:** S. **Risk:** low.

---

## Authenticity polish (no demo agenda — just makes it feel real)

These raise the CDN cache-hit-ratio story too (static, cacheable content):

- **"Paddock Notes" blog** — a few in-character posts about the memorabilia. Cacheable at
  the edge; makes the site feel inhabited rather than a skeleton.
- **Race-calendar banner** — "Next up: Monza · 3 days." Cheap, on-brand, cacheable.
- **Recently-viewed / trending ticker** on the homepage.
- **In-character loading / empty states** — "Formation lap…", "Your garage is empty."

---

## Suggested sequencing

1. ~~**Honeypot + shadow APIs** (P1)~~ ✅ shipped — two Fastly capabilities for the least effort.
2. ~~**Payment carding header** (P3)~~ ✅ shipped — one header + persona over existing flow; unlocks CC-VAL-*.
3. **Gift cards** (P2) ← **next** — the marquee carding demo (GC-VAL-*), plus a real shop feature.
4. **Limited drop** (P4) — the headline Bot Management showcase.
5. Fill in P5–P9 per the specific demo you're running.
6. Authenticity polish as time allows — good for the CDN cache story.

Each of P2–P9 is independent; nothing blocks anything else.
