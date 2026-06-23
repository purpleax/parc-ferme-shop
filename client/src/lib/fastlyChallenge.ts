// Fastly Bot Management — embedded client challenge integration.
//
// Docs: https://www.fastly.com/documentation/guides/security/bot-management/
//       client-challenges/embedding-challenges-in-pages/
//
// How it works: when the app is served behind a Fastly service with embedded
// client challenges enabled, Fastly serves a small challenge script at the
// universal prefix "/_fs-ch-1T1wmsGaOgGaSxcX/" plus the filename you chose
// (e.g. "/_fs-ch-1T1wmsGaOgGaSxcX/challenge.js"). The prefix is the same for
// every Fastly customer; only the filename is customer-chosen. The script
// attaches to any `<div class="fastly-challenge">` on the page and
// reflects its progress on that element's `data-challenge-status` attribute
// (started → processing → complete, or captcha_prompted / error). Once the
// challenge completes, Fastly mints a token (cookie) that its edge validates on
// subsequent requests to the paths you protect (login, cart, checkout, …).
//
// The challenge URL has the shape `<prefix><filename>`, e.g.
// `/_fs-ch-1T1wmsGaOgGaSxcX/challenge.js`. The prefix `/_fs-ch-1T1wmsGaOgGaSxcX/`
// is the SAME for every Fastly customer — only the filename is customer-chosen
// (you pick it when enabling embedded challenges). So you normally only need to
// set the filename; the prefix is built in (and overridable).
//
// Configuration (build-time, Vite):
//   VITE_FASTLY_CHALLENGE_FILE      the script filename you chose, e.g. "challenge.js"
//   VITE_FASTLY_CHALLENGE_PATH      full path override (wins over FILE) if ever needed
//   VITE_FASTLY_CHALLENGE_PREFIX    override the universal prefix (default below)
//   VITE_FASTLY_CHALLENGE_FAILOPEN  "false" to keep actions gated if the script
//                                   can't load (default "true" = fail open)
//
// When neither FILE nor PATH is set the integration is DORMANT: no badge renders
// and nothing is gated, so local development and CI are unaffected. The real
// challenge activates automatically once a filename (or full path) is set.

const env = import.meta.env as Record<string, string | undefined>;

// Universal Fastly embedded-challenge path prefix (identical across customers).
export const DEFAULT_CHALLENGE_PREFIX = '/_fs-ch-1T1wmsGaOgGaSxcX/';

// Resolve the challenge script URL from config. Always returns an absolute URL
// or root-absolute path (or "" when unset) — never a page-relative value like
// "challenge.js" that the browser would resolve against the current route
// (e.g. "/product/challenge.js"). Accepts either a filename
// (VITE_FASTLY_CHALLENGE_FILE, recommended) or a full-path override
// (VITE_FASTLY_CHALLENGE_PATH), and is forgiving of a bare filename in either.
function resolveChallengePath(): string {
  const rawPrefix = (env.VITE_FASTLY_CHALLENGE_PREFIX ?? DEFAULT_CHALLENGE_PREFIX).trim();
  const prefix = rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`;
  const withPrefix = (name: string) => `${prefix}${name.replace(/^\/+/, '')}`;

  const explicit = (env.VITE_FASTLY_CHALLENGE_PATH ?? '').trim();
  if (explicit) {
    if (/^https?:\/\//i.test(explicit)) return explicit; // full URL → verbatim
    if (explicit.includes('/')) return `/${explicit.replace(/^\/+/, '')}`; // a path → force root-absolute
    return withPrefix(explicit); // a bare filename mistakenly put in PATH → prefix it
  }

  const file = (env.VITE_FASTLY_CHALLENGE_FILE ?? '').trim();
  if (!file) return '';
  return withPrefix(file); // filename → always prefixed
}

// Kill switch — when on, NO challenge.js is loaded, no badge renders and nothing
// is gated (fully dormant), regardless of any challenge filename/path. Three ways
// to trigger it, in the order checked — each is an independent off-switch:
//
//   1. window.FASTLY_CHALLENGE_DISABLED === true
//      Runtime + global. An operator can inject this at the Fastly edge
//      (e.g. add `<script>window.FASTLY_CHALLENGE_DISABLED=true</script>` to the
//      HTML via VCL) to kill the challenge for ALL users instantly — no rebuild.
//
//   2. VITE_FASTLY_CHALLENGE_DISABLED=true  (build-time env)
//      A permanent off-switch baked into the build.
//
//   3. ?fastlychallenge=off  in the page URL
//      Per-browser runtime escape hatch (persists in localStorage; ?fastlychallenge=on
//      clears it). Handy to unblock a single stuck browser without a rebuild.
function challengeDisabled(): boolean {
  try {
    if ((window as unknown as { FASTLY_CHALLENGE_DISABLED?: unknown }).FASTLY_CHALLENGE_DISABLED === true) {
      return true;
    }
  } catch {
    /* no window (tests/SSR) */
  }
  if ((env.VITE_FASTLY_CHALLENGE_DISABLED ?? '').toLowerCase() === 'true') return true;
  try {
    const q = new URLSearchParams(window.location.search).get('fastlychallenge');
    if (q === 'off') localStorage.setItem('fastlyChallengeDisabled', '1');
    else if (q === 'on') localStorage.removeItem('fastlyChallengeDisabled');
    if (localStorage.getItem('fastlyChallengeDisabled') === '1') return true;
  } catch {
    /* no window/localStorage */
  }
  return false;
}

export const challengeKilled = challengeDisabled();
export const challengePath = resolveChallengePath();
export const challengeConfigured = !challengeKilled && challengePath.length > 0;
export const challengeFailOpen = (env.VITE_FASTLY_CHALLENGE_FAILOPEN ?? 'true').toLowerCase() !== 'false';

// How long to wait for the challenge to complete before, if fail-open is on,
// releasing the soft gate so a Fastly asset hiccup can't lock users out.
export const CHALLENGE_TIMEOUT_MS = 8000;

// Advanced Client-Side Detection (ACSD) — passive headless browser detection.
//
// Unlike the embedded challenge, ACSD is injected directly into <head> at build
// time by the Vite fastlyAcsdPlugin (vite.config.ts) and runs on every page load
// without any DOM element, gating, or user-visible badge.
//
// URL shape: <prefix>assets/<filename>, e.g.
//   /_fs-ch-1T1wmsGaOgGaSxcX/assets/script.js
//
// Configure via VITE_FASTLY_ACSD_FILE (just the filename). Dormant when unset.
//
// Kill-switch note: only the BUILD-TIME kill switch (VITE_FASTLY_CHALLENGE_DISABLED=true)
// suppresses ACSD — the script is baked into the HTML before runtime JS can run.
// The runtime kill switches (window.FASTLY_CHALLENGE_DISABLED, ?fastlychallenge=off)
// do NOT affect it.
function resolveAcsdPath(): string {
  if (challengeKilled) return '';
  const file = (env.VITE_FASTLY_ACSD_FILE ?? '').trim();
  if (!file) return '';
  const rawPrefix = (env.VITE_FASTLY_CHALLENGE_PREFIX ?? DEFAULT_CHALLENGE_PREFIX).trim();
  const prefix = rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`;
  return `${prefix}assets/${file.replace(/^\/+/, '')}`;
}

export const acsdPath = resolveAcsdPath();
export const acsdConfigured = acsdPath.length > 0;

export type ChallengeStatus =
  | 'inactive' // feature not configured
  | 'started'
  | 'processing'
  | 'complete'
  | 'captcha_prompted'
  | 'error';

let scriptPromise: Promise<boolean> | null = null;

// Safety net: the challenge script must be loaded from a root-absolute path or a
// full URL, never a page-relative one (which would resolve against the current
// route, e.g. "/product/challenge.js"). resolveChallengePath() guarantees this,
// but guard anyway so a future regression can't ship a broken <script src>.
const challengePathIsAbsolute = /^(https?:\/\/|\/)/i.test(challengePath);

/** Idempotently injects the Fastly challenge script. Resolves true if it loaded. */
export function loadChallengeScript(): Promise<boolean> {
  if (!challengeConfigured) return Promise.resolve(false);
  if (!challengePathIsAbsolute) {
    console.error(
      `[fastly-challenge] Refusing to load a page-relative challenge script "${challengePath}". ` +
        `Set VITE_FASTLY_CHALLENGE_FILE to just the filename (e.g. "challenge.js").`
    );
    return Promise.resolve(false);
  }
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<boolean>((resolve) => {
    if (document.querySelector('script[data-fastly-challenge]')) return resolve(true);
    const script = document.createElement('script');
    script.src = challengePath;
    script.defer = true;
    script.setAttribute('data-fastly-challenge', '');
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return scriptPromise;
}
