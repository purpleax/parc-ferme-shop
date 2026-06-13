# Fastly Bot Management — embedded client challenges

This store integrates [Fastly Bot Management embedded client
challenges](https://www.fastly.com/documentation/guides/security/bot-management/client-challenges/embedding-challenges-in-pages/)
to verify a real device before the most abuse-prone actions, and surfaces a
discreet **"Verified by Fastly Bot Management"** badge in the storefront design.

The integration is **dormant until configured**, so local development, the test
suite and CI are unaffected. It activates automatically once the app is built
with the challenge script **filename** you chose in Fastly — the path prefix
(`/_fs-ch-1T1wmsGaOgGaSxcX/`) is the same for every Fastly customer and is built
in, so only the filename is needed.

---

## What it does

When configured, on the critical-path screens the app:

1. Loads Fastly's challenge script (the universal `/_fs-ch-1T1wmsGaOgGaSxcX/`
   prefix + your chosen filename, e.g. `/_fs-ch-1T1wmsGaOgGaSxcX/challenge.js`).
2. Renders a `<div class="fastly-challenge">` mount that Fastly drives through
   its lifecycle, reflected on the element's `data-challenge-status` attribute
   (`started` → `processing` → `complete`, or `captcha_prompted` / `error`).
3. Shows a **discreet status badge** next to the guarded action:
   - *Verifying device with Fastly…* (a small spinner) while the check runs
   - **Verified by Fastly Bot Management** (a subtle shield-check) once complete
   - *Security check required* if an interactive challenge is prompted
   - *Device verification unavailable* if the script can't load
4. **Soft-gates** the action — the button is disabled until the device is
   verified (`data-challenge-status="complete"`).
5. If Fastly prompts an **interactive** (CAPTCHA) challenge, a small themed
   "Quick security check" panel surfaces at the bottom of the screen and hosts
   the challenge; it's hidden the rest of the time.

### Where it appears (critical areas only)

| Screen | Guarded action |
|---|---|
| Login (`/login`) | Sign in |
| Register (`/register`) | Create account |
| Product detail (`/product/:slug`) | Add to garage (add to cart) |
| Product grid card | Quick add to cart (gated; no badge, to stay discreet) |
| Cart (`/cart`) | Proceed to checkout |
| Checkout (`/checkout`) | Continue to payment **and** Pay |

Browsing, search, category and content pages are intentionally left untouched.

---

## Configuration

The challenge script URL is `<prefix><filename>`, e.g.
`/_fs-ch-1T1wmsGaOgGaSxcX/challenge.js`. The prefix `/_fs-ch-1T1wmsGaOgGaSxcX/`
is **the same for every Fastly customer** — only the **filename** is yours to
choose (you pick it when enabling embedded challenges). So in almost all cases
you only set the filename; the prefix is built in.

Build-time environment variables (Vite). See [`client/.env.example`](../client/.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `VITE_FASTLY_CHALLENGE_FILE` | *(empty)* | The challenge script **filename** you chose, e.g. `challenge.js`. Empty = integration dormant. **This is normally the only one you set.** |
| `VITE_FASTLY_CHALLENGE_PATH` | *(empty)* | Full path override; wins over `FILE`. Only needed for a non-standard URL. A bare filename here is auto-prefixed too, and any value is forced root-absolute so the script can never load page-relative (e.g. `/product/challenge.js`). |
| `VITE_FASTLY_CHALLENGE_PREFIX` | `/_fs-ch-1T1wmsGaOgGaSxcX/` | The universal prefix. Override only if Fastly ever changes it. |
| `VITE_FASTLY_CHALLENGE_FAILOPEN` | `true` | `false` keeps actions gated if the challenge script can't load. Default fails open after ~8s so a Fastly asset hiccup can't lock customers out. |

```bash
# Local build / dev with the challenge active:
echo 'VITE_FASTLY_CHALLENGE_FILE=challenge.js' > client/.env.local
npm run dev
```

`VITE_*` vars are **baked in at build time** (not read at container runtime), so
the value must be present when the frontend is built. For the Docker image either
approach works:

```bash
# Option 1 — create client/.env (it's copied into the build context):
echo 'VITE_FASTLY_CHALLENGE_FILE=challenge.js' > client/.env
docker compose up --build

# Option 2 — pass it as a build arg (overrides client/.env if both are set):
docker compose build --build-arg VITE_FASTLY_CHALLENGE_FILE=challenge.js
# or: VITE_FASTLY_CHALLENGE_FILE=challenge.js docker compose up --build
```

> Because it's baked in at build time, changing the filename means **rebuilding**
> the image (`--build`), not just restarting the container.

---

## Fastly-side setup (one time, in the Fastly control plane)

These steps happen on your Fastly service, not in this repo:

1. Enable **Bot Management** and the **Next-Gen WAF** on the service in front of
   the store, and turn on **client challenges**.
2. Enable **embedded** challenges and choose the script **filename** (e.g.
   `challenge.js`). The full URL is the universal prefix
   `/_fs-ch-1T1wmsGaOgGaSxcX/` followed by that filename. Put just the filename in
   `VITE_FASTLY_CHALLENGE_FILE` and rebuild the frontend.
3. Configure which requests require a valid challenge token. Match the actions
   the UI guards so the edge enforces what the storefront implies:

   | Method & path | Action |
   |---|---|
   | `POST /api/auth/login` | Login |
   | `POST /api/auth/register` | Registration |
   | `POST /api/cart/*/items` | Add to cart |
   | `POST /api/orders` | Create order |
   | `POST /api/payments/intent` | Start payment |
   | `POST /api/payments/*/confirm` | Confirm payment |
   | `POST /api/newsletter` | Newsletter signup (optional; bot-attractive) |

4. Leave read-only catalog/browse endpoints unchallenged so crawlers and the CDN
   cache behave normally.

> The frontend badge and soft-gate are UX affordances. **The actual enforcement
> is at the Fastly edge** via the challenge token — the app does not need to
> validate it. Even if a client bypasses the disabled button, the edge rejects
> requests to protected paths without a valid token.

---

## How it behaves without Fastly

- **`VITE_FASTLY_CHALLENGE_PATH` empty (default):** dormant. No script is loaded,
  no badge renders, nothing is gated. The store behaves exactly as it does today.
- **Configured but script unreachable (e.g. not actually behind Fastly):** with
  fail-open on (default) the gate releases after a short timeout and the badge
  shows *"Device verification unavailable"*. Set `VITE_FASTLY_CHALLENGE_FAILOPEN=false`
  to keep actions gated instead.

## Implementation map

| File | Role |
|---|---|
| `client/src/lib/fastlyChallenge.ts` | Config + idempotent script loader |
| `client/src/context/FastlyChallengeContext.tsx` | Provider: owns the challenge mount, tracks status, exposes `verified` |
| `client/src/components/DeviceVerification.tsx` | The discreet status badge |
| `client/src/index.css` | Themed styles for the challenge container + interactive panel |
| Critical pages/components | Consume `useDeviceVerification()` to gate the action + render the badge |
