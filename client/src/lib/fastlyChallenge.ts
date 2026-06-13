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

function resolveChallengePath(): string {
  const explicit = (env.VITE_FASTLY_CHALLENGE_PATH ?? '').trim();
  if (explicit) return explicit;
  const file = (env.VITE_FASTLY_CHALLENGE_FILE ?? '').trim();
  if (!file) return '';
  const rawPrefix = (env.VITE_FASTLY_CHALLENGE_PREFIX ?? DEFAULT_CHALLENGE_PREFIX).trim();
  const prefix = rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`;
  return `${prefix}${file.replace(/^\/+/, '')}`;
}

export const challengePath = resolveChallengePath();
export const challengeConfigured = challengePath.length > 0;
export const challengeFailOpen = (env.VITE_FASTLY_CHALLENGE_FAILOPEN ?? 'true').toLowerCase() !== 'false';

// How long to wait for the challenge to complete before, if fail-open is on,
// releasing the soft gate so a Fastly asset hiccup can't lock users out.
export const CHALLENGE_TIMEOUT_MS = 8000;

export type ChallengeStatus =
  | 'inactive' // feature not configured
  | 'started'
  | 'processing'
  | 'complete'
  | 'captcha_prompted'
  | 'error';

let scriptPromise: Promise<boolean> | null = null;

/** Idempotently injects the Fastly challenge script. Resolves true if it loaded. */
export function loadChallengeScript(): Promise<boolean> {
  if (!challengeConfigured) return Promise.resolve(false);
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
