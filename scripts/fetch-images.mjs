#!/usr/bin/env node
/**
 * One-time setup: downloads openly licensed motorsport photography from
 * Wikimedia Commons into server/public/products/. The app falls back to
 * generated SVG art for any image that is missing, so this script is
 * best-effort and re-runnable.
 *
 *   node scripts/fetch-images.mjs           # fetch missing images
 *   node scripts/fetch-images.mjs --force   # re-fetch everything
 *
 * Sources and attribution are recorded in server/public/products/sources.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'server', 'public', 'products');
const FORCE = process.argv.includes('--force');
const UA = 'ParcFermeDemoStore/1.0 (security demo seed script)';

// seed → ordered list of Commons search queries; idx picks the nth good hit.
const MANIFEST = [
  // products
  { seed: '1992-monza-podium-replica-helmet', queries: ['Nigel Mansell helmet', 'Formula One driver helmet', 'Formula One helmet'], idx: 0 },
  { seed: 'carbon-track-spec-helmet-shell', queries: ['Formula One helmet', 'racing helmet carbon'], idx: 1 },
  { seed: '1988-season-tribute-mini-helmet-1-2', queries: ['Ayrton Senna helmet', 'Formula One helmet'], idx: 0 },
  { seed: 'visor-tear-off-set-monaco', queries: ['Formula One helmet visor', 'Formula One driver helmet'], idx: 0 },
  { seed: 'race-worn-nomex-gloves-silverstone-1997', queries: ['Sparco racing gloves', 'racing gloves', 'Formula One cockpit driver hands'], idx: 0 },
  { seed: 'pit-crew-fireproof-suit-northline-racing', queries: ['Formula One pit crew', 'Formula One pit stop'], idx: 0 },
  { seed: 'race-suit-replica-scuderia-veloce-2024', queries: ['Formula One race suit museum', 'Formula One racing suit'], idx: 0 },
  { seed: 'driver-boots-practice-session-worn', queries: ['Formula One driver garage', 'Formula One paddock'], idx: 1 },
  { seed: '1-8-scale-championship-car-2021-season', queries: ['Formula One scale model', 'Formula 1 model car'], idx: 0 },
  { seed: '1-18-classic-v12-spa-winner-1995', queries: ['Formula One scale model', 'Formula 1 model car'], idx: 1 },
  { seed: '1-43-grid-set-full-2026-season', queries: ['Formula One diecast model', 'Formula One scale model'], idx: 2 },
  { seed: 'wind-tunnel-model-front-wing-section', queries: ['Formula One front wing', 'Formula One aerodynamics'], idx: 0 },
  { seed: 'carbon-front-wing-endplate-2019-spec', queries: ['Formula One front wing detail', 'Formula One front wing'], idx: 1 },
  { seed: 'f1-steering-wheel-replica-fully-wired', queries: ['Formula One steering wheel', 'F1 steering wheel'], idx: 0 },
  { seed: 'magnesium-wheel-rim-race-used', queries: ['Formula One wheel tyre', 'Formula One pirelli tyre'], idx: 0 },
  { seed: 'carbon-brake-disc-caliper-display', queries: ['Formula One brake disc', 'Formula One brake'], idx: 0 },
  { seed: 'monaco-hairpin-fine-art-print', queries: ['Monaco Grand Prix hairpin', 'Monaco Grand Prix'], idx: 0 },
  { seed: 'spa-eau-rouge-panorama-lithograph', queries: ['Eau Rouge Spa Francorchamps', 'Spa Francorchamps circuit'], idx: 0 },
  { seed: '1976-season-poster-restored-archive', queries: ['1976 Formula One season', '1976 Grand Prix'], idx: 0 },
  { seed: 'night-race-photography-marina-bay', queries: ['Marina Bay Street Circuit', 'Singapore Grand Prix'], idx: 0 },
  { seed: 'podium-champagne-signed-magnum', queries: ['Formula One podium champagne', 'Grand Prix podium celebration'], idx: 0 },
  { seed: 'pit-board-final-lap-display', queries: ['pit board racing', 'Formula One pit lane', 'Formula One pit wall'], idx: 0 },
  { seed: 'team-cap-2026-limited-edition', queries: ['Formula One cap', 'racing fans grandstand', 'Formula One podium celebration'], idx: 0 },
  { seed: 'paddock-pass-collection-1984-1999', queries: ['Formula One paddock', 'Formula One garage'], idx: 0 },
  // category tiles
  { seed: 'cat-helmets', queries: ['Formula One helmets collection', 'Formula One helmet display'], idx: 0 },
  { seed: 'cat-race-worn', queries: ['Formula One driver suit', 'Formula One drivers'], idx: 0 },
  { seed: 'cat-models', queries: ['Formula One scale model', 'Formula 1 model car'], idx: 3 },
  { seed: 'cat-parts', queries: ['Formula One garage mechanics', 'Formula One car detail'], idx: 0 },
  { seed: 'cat-prints', queries: ['Monaco Grand Prix', 'Formula One race start'], idx: 1 },
  { seed: 'cat-collectibles', queries: ['Formula One memorabilia', 'Formula One trophy'], idx: 0 },
  // hero
  { seed: 'hero-f1', queries: ['Formula One race start', 'Formula One car on track', 'Grand Prix race'], idx: 0 },
];

async function searchCommons(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '25',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1200',
  }).toString();
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }
    break;
  }
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data?.query?.pages ?? {});
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return pages
    .map((p) => p.imageinfo?.[0])
    .filter(Boolean)
    .filter((ii) => ii.mime === 'image/jpeg' && ii.width >= 700)
    .filter((ii) => {
      const ratio = ii.width / ii.height;
      return ratio > 0.55 && ratio < 2.4;
    });
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10_000) throw new Error('file too small');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const sourcesPath = path.join(OUT_DIR, 'sources.json');
const sources = fs.existsSync(sourcesPath) ? JSON.parse(fs.readFileSync(sourcesPath, 'utf8')) : {};
const used = new Set(Object.values(sources).map((s) => s.url));

let ok = 0;
let skipped = 0;
let failed = 0;

for (const item of MANIFEST) {
  const dest = path.join(OUT_DIR, `${item.seed}.jpg`);
  if (!FORCE && fs.existsSync(dest)) {
    skipped++;
    continue;
  }
  let done = false;
  for (const query of item.queries) {
    try {
      const hits = (await searchCommons(query)).filter((ii) => !used.has(ii.thumburl ?? ii.url));
      const pick = hits[Math.min(item.idx, Math.max(0, hits.length - 1))];
      if (!pick) continue;
      const url = pick.thumburl ?? pick.url;
      const bytes = await download(url, dest);
      used.add(url);
      const meta = pick.extmetadata ?? {};
      sources[item.seed] = {
        url,
        descriptionUrl: pick.descriptionurl,
        license: meta.LicenseShortName?.value ?? 'see description page',
        artist: (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || 'unknown',
        query,
      };
      console.log(`✔ ${item.seed} (${Math.round(bytes / 1024)} KB) — "${query}"`);
      ok++;
      done = true;
      break;
    } catch (err) {
      console.log(`  retrying ${item.seed}: ${err.message}`);
    }
  }
  if (!done) {
    console.log(`✘ ${item.seed} — no usable result (SVG fallback will be used)`);
    failed++;
  }
  await new Promise((r) => setTimeout(r, 1500)); // be polite to the API
}

fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2));
console.log(`\nDone: ${ok} fetched, ${skipped} already present, ${failed} fell back to SVG.`);
console.log(`Attribution written to ${path.relative(process.cwd(), sourcesPath)}`);
