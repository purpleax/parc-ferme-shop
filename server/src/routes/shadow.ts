import { Router } from 'express';

// Honeypot + shadow surface. NONE of these routes appear in openapi.ts on
// purpose — that is the whole point. They are real, reachable, logged routes
// that the API spec never mentions, so:
//   - Fastly API Discovery flags them as unknown / undocumented APIs.
//   - The honeypot below has no legitimate caller at all, so any hit is a
//     high-confidence automation signal for an NGWAF rule.
// Do NOT add these to the OpenAPI spec or the README endpoint table.
const router = Router();

// GET /api/special-offers — pure honeypot. It is Disallow-ed in robots.txt and
// linked only from a visually-hidden, aria-hidden element in the footer, so a
// human never reaches it. A link-following scraper or a robots.txt-reading bot
// does. Returns a plausible 200 (keeps a bot engaged) and tags the response so
// an edge rule can match on the marker header as well as the path.
router.get('/special-offers', (req, res) => {
  res.setHeader('X-Trap', 'honeypot');
  console.log(
    `\x1b[35m[honeypot]\x1b[0m /api/special-offers hit ip=${req.ip} ` +
      `ua="${req.headers['user-agent'] ?? ''}" req=${req.id}`
  );
  res.json({
    offers: [
      { code: 'VAULT-INSIDER', description: 'Members-only paddock pricing', discountPct: 40 },
      { code: 'EARLY-GRID', description: 'Pre-release access to the next drop', discountPct: 25 },
    ],
    note: 'Unlisted offers — please do not share.',
  });
});

// --- Shadow / undocumented surface (looks like forgotten real endpoints) ---

// A retired API version that "someone forgot to turn off".
router.get('/v1/orders', (_req, res) => {
  res.json({
    deprecated: true,
    message: 'The v1 orders API is retired. Use /api/orders.',
    sunset: '2024-01-01',
  });
});

// Internal-looking operational metrics. Non-sensitive, but the sort of thing
// that should never have been exposed — exactly what discovery should catch.
router.get('/internal/metrics', (_req, res) => {
  res.json({
    service: 'parc-ferme-api',
    uptimeSeconds: Math.round(process.uptime()),
    memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    node: process.version,
  });
});

// Juicy-looking but deliberately fictional — leaks nothing real.
router.get('/debug/config', (_req, res) => {
  res.json({
    env: 'demo',
    region: 'edge-demo',
    buildChannel: 'stable',
    featureFlags: { newCheckout: false, giftCards: false, drops: false },
  });
});

export default router;
