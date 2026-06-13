import express, { Router } from 'express';
import { config } from '../config.js';

const router = Router();

// Real product photography (server/public/products/*.jpg), CDN-cacheable.
router.use(
  '/products',
  express.static(config.photosDir, {
    maxAge: '1d',
    immutable: true,
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=86400, immutable'),
  })
);

// Curated premium gradient palettes [from, to, accent]
const PALETTES: [string, string, string][] = [
  ['#2d3a2e', '#5c7156', '#e8e0d0'], // forest
  ['#3d2f28', '#8a6f55', '#ead9bd'], // walnut
  ['#22303c', '#4d6a7a', '#dce8ec'], // slate blue
  ['#4a2c2a', '#a05c44', '#f0ddcd'], // terracotta
  ['#2e2a3d', '#6c5f8d', '#e5dff0'], // dusk violet
  ['#33312b', '#857d5f', '#efe9d4'], // olive stone
  ['#1f3036', '#3e6f6a', '#d8ece5'], // deep teal
  ['#3a2f33', '#96687a', '#f2dfe6'], // plum rose
];

function hashSeed(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h;
}

function buildSvg(seed: string): string {
  const h = hashSeed(seed);
  const [from, to, accent] = PALETTES[h % PALETTES.length];
  const r = (n: number) => ((h >> (n * 3)) % 100) / 100; // deterministic pseudo-randoms
  const cx1 = 150 + r(1) * 500;
  const cy1 = 120 + r(2) * 400;
  const radius1 = 120 + r(3) * 160;
  const cx2 = 100 + r(4) * 600;
  const cy2 = 150 + r(5) * 380;
  const radius2 = 70 + r(6) * 110;
  const arcY = 480 + r(7) * 140;
  const rotation = Math.floor(r(8) * 40 - 20);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="Product image">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.4" r="0.8">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="url(#glow)"/>
  <g transform="rotate(${rotation} 400 400)">
    <circle cx="${cx1.toFixed(0)}" cy="${cy1.toFixed(0)}" r="${radius1.toFixed(0)}" fill="${accent}" opacity="0.16"/>
    <circle cx="${cx2.toFixed(0)}" cy="${cy2.toFixed(0)}" r="${radius2.toFixed(0)}" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.45"/>
    <path d="M -100 ${arcY.toFixed(0)} Q 400 ${(arcY - 220).toFixed(0)} 900 ${arcY.toFixed(0)}"
      fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.35"/>
    <path d="M -100 ${(arcY + 60).toFixed(0)} Q 400 ${(arcY - 160).toFixed(0)} 900 ${(arcY + 60).toFixed(0)}"
      fill="none" stroke="${accent}" stroke-width="1" opacity="0.22"/>
  </g>
  <rect x="24" y="24" width="752" height="752" fill="none" stroke="${accent}" stroke-width="1" opacity="0.25"/>
</svg>`;
}

// Deterministic, cacheable product art — ideal for CDN cache-hit demos.
router.get('/products/:seed.svg', (req, res) => {
  const seed = String(req.params.seed).slice(0, 120);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.send(buildSvg(seed));
});

export default router;
