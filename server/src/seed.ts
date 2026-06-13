import bcrypt from 'bcryptjs';
import type { Db } from './db.js';

export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@parcferme.dev', password: 'Admin123!', name: 'Margot Hale' },
  customer: { email: 'ava@demo.dev', password: 'Customer123!', name: 'Ava Chen' },
};

const categories = [
  { slug: 'helmets', name: 'Helmets', description: 'Signed lids and replica shells from the sport’s defining eras.', seed: 'cat-helmets' },
  { slug: 'race-worn', name: 'Race-Worn', description: 'Suits, gloves and boots that crossed the line first.', seed: 'cat-race-worn' },
  { slug: 'models', name: 'Scale Models', description: 'Museum-grade replicas from 1:43 to 1:8.', seed: 'cat-models' },
  { slug: 'parts', name: 'Car Parts', description: 'Wings, wheels and steering — genuine components off the car.', seed: 'cat-parts' },
  { slug: 'prints', name: 'Prints & Art', description: 'Fine-art photography and archive posters of the great circuits.', seed: 'cat-prints' },
  { slug: 'collectibles', name: 'Collectibles', description: 'Pit boards, podium champagne and paddock ephemera.', seed: 'cat-collectibles' },
];

type SeedProduct = {
  sku: string; name: string; cat: string; price: number; compareAt?: number;
  stock: number; rating: number; ratingCount: number; badge?: string; featured?: boolean;
  description: string;
};

const products: SeedProduct[] = [
  // Helmets
  { sku: 'PF-HE-001', name: '1992 Monza Podium Replica Helmet', cat: 'helmets', price: 28900, stock: 6, rating: 4.9, ratingCount: 87, badge: 'Signed', featured: true,
    description: 'A full-size replica of the helmet worn to victory at Monza in 1992, hand-signed across the visor strip. Painted by the original design house, finished with period-correct sponsor decals and supplied with a numbered certificate of authenticity.' },
  { sku: 'PF-HE-002', name: 'Carbon Track-Spec Helmet Shell', cat: 'helmets', price: 64900, stock: 4, rating: 4.8, ratingCount: 31, badge: 'Limited',
    description: 'An unpainted FIA-spec carbon shell from a current-generation helmet manufacturer — the same monocoque construction that sits on the grid today. Display-mounted on a machined aluminium plinth.' },
  { sku: 'PF-HE-003', name: '1988 Season Tribute Mini Helmet 1:2', cat: 'helmets', price: 18900, stock: 22, rating: 4.7, ratingCount: 164,
    description: 'A half-scale tribute to the most dominant season in the sport’s history. Sixteen races, fifteen wins — and one unmistakable paint scheme, faithfully reproduced with a clear-coat lacquer finish.' },
  { sku: 'PF-HE-004', name: 'Visor Tear-Off Set — Monaco', cat: 'helmets', price: 8900, compareAt: 11900, stock: 31, rating: 4.5, ratingCount: 92, badge: 'Sale',
    description: 'Three genuine visor tear-offs peeled in anger through the streets of Monte Carlo, framed against a circuit map with turn-by-turn annotations. The cheapest way to own something that has actually lapped Monaco.' },
  // Race-worn
  { sku: 'PF-RW-001', name: 'Race-Worn Nomex Gloves — Silverstone 1997', cat: 'race-worn', price: 119000, stock: 2, rating: 5.0, ratingCount: 12, badge: 'Race-worn', featured: true,
    description: 'A matched pair of Nomex gloves worn through a full British Grand Prix distance in 1997, complete with visible wheel-wear across both palms. Photo-matched to broadcast footage and accompanied by team provenance papers.' },
  { sku: 'PF-RW-002', name: 'Pit Crew Fireproof Suit — Northline Racing', cat: 'race-worn', price: 74900, stock: 5, rating: 4.8, ratingCount: 26,
    description: 'A complete fireproof pit suit from the Northline Racing crew, used across a full season of sub-three-second stops. Scuffs, fuel staining and all — this one worked for a living.' },
  { sku: 'PF-RW-003', name: 'Race Suit Replica — Scuderia Veloce 2024', cat: 'race-worn', price: 32900, stock: 14, rating: 4.6, ratingCount: 118,
    description: 'An official replica of the Scuderia Veloce 2024 race suit in triple-layer construction with embroidered sponsor patches. Cut to the same pattern as the drivers’ own, minus the champagne stains.' },
  { sku: 'PF-RW-004', name: 'Driver Boots — Practice Session Worn', cat: 'race-worn', price: 45900, stock: 3, rating: 4.7, ratingCount: 19, badge: 'Race-worn',
    description: 'Lightweight race boots worn through free practice at a 2023 European round, with heel wear from the footwell and a signed lace tag. Sized 42, displayed better than driven.' },
  // Scale models
  { sku: 'PF-SM-001', name: '1:8 Scale Championship Car — 2021 Season', cat: 'models', price: 189000, stock: 3, rating: 5.0, ratingCount: 22, badge: 'Limited', featured: true,
    description: 'Over 1,000 individually engineered parts, a ten-month build time and a paint match taken from the team’s own spec sheets. This 1:8 masterpiece of the 2021 title winner is the closest thing to the car without a garage.' },
  { sku: 'PF-SM-002', name: '1:18 Classic V12 — Spa Winner 1995', cat: 'models', price: 24900, stock: 18, rating: 4.8, ratingCount: 203,
    description: 'The last of the great V12 winners, captured in 1:18 with opening bodywork, detailed pushrod suspension and rain-spec Goodyears — exactly as it crossed the line at a soaking Spa-Francorchamps.' },
  { sku: 'PF-SM-003', name: '1:43 Grid Set — Full 2026 Season', cat: 'models', price: 99900, stock: 7, rating: 4.7, ratingCount: 41, badge: 'New',
    description: 'All eleven teams, both cars, one walnut display case. The complete 2026 grid in 1:43 resin with photo-etched details, delivered with a numbered plaque and team-by-team specification booklet.' },
  { sku: 'PF-SM-004', name: 'Wind Tunnel Model — Front Wing Section', cat: 'models', price: 459000, stock: 1, rating: 5.0, ratingCount: 6, badge: 'Limited',
    description: 'A genuine 60%-scale wind tunnel front wing section, rapid-prototyped and pressure-tapped by a midfield team during 2019 development. One of one — when it’s gone, it’s gone.' },
  // Car parts
  { sku: 'PF-PT-001', name: 'Carbon Front Wing Endplate — 2019 Spec', cat: 'parts', price: 159000, stock: 2, rating: 4.9, ratingCount: 17, badge: 'Race-worn', featured: true,
    description: 'A full carbon front wing endplate that started a Grand Prix in 2019, retired after contact at turn one and retrieved by the team. Stone-chipped, rubber-marked and absolutely genuine, with a team letter of provenance.' },
  { sku: 'PF-PT-002', name: 'F1 Steering Wheel Replica — Fully Wired', cat: 'parts', price: 84900, stock: 6, rating: 4.8, ratingCount: 54,
    description: 'A full-size, fully wired replica of a current-spec steering wheel: working rotaries, paddle clutch, OLED display loop and a carbon plate. USB out, so it doubles as the world’s most overqualified sim wheel.' },
  { sku: 'PF-PT-003', name: 'Magnesium Wheel Rim — Race Used', cat: 'parts', price: 69900, stock: 4, rating: 4.7, ratingCount: 28, badge: 'Race-worn',
    description: 'A forged magnesium rear rim that completed two Grand Prix race distances, complete with brake-dust patina and tyre-bead witness marks. Supplied with a tempered glass top for coffee-table duty.' },
  { sku: 'PF-PT-004', name: 'Carbon Brake Disc & Caliper Display', cat: 'parts', price: 54900, stock: 8, rating: 4.6, ratingCount: 36,
    description: 'A carbon-carbon brake disc and six-piston caliper assembly, sectioned to show the internal vane structure that survives 1,000°C. Mounted on a rotating display base with an engraved data plate.' },
  // Prints & art
  { sku: 'PF-PR-001', name: 'Monaco Hairpin — Fine Art Print', cat: 'prints', price: 12900, stock: 25, rating: 4.8, ratingCount: 141, featured: true,
    description: 'Shot from the Fairmont balcony on a medium-format back, this print captures the slowest corner in motorsport at its most theatrical. Giclée on 308gsm cotton rag, embossed and numbered, edition of 250.' },
  { sku: 'PF-PR-002', name: 'Spa Eau Rouge Panorama — Lithograph', cat: 'prints', price: 29900, stock: 12, rating: 4.9, ratingCount: 64, badge: 'Limited',
    description: 'A metre-wide panoramic lithograph of Eau Rouge–Raidillon taken in changing weather, the most photographed hundred metres of tarmac in racing. Edition of 100, each signed by the photographer.' },
  { sku: 'PF-PR-003', name: '1976 Season Poster — Restored Archive', cat: 'prints', price: 8900, stock: 40, rating: 4.5, ratingCount: 187,
    description: 'A digitally restored reproduction of the iconic 1976 season poster, the year the championship went to the final race in the rain at Fuji. Offset-printed on heavyweight matte stock.' },
  { sku: 'PF-PR-004', name: 'Night Race Photography — Marina Bay', cat: 'prints', price: 14900, stock: 19, rating: 4.7, ratingCount: 73, badge: 'New',
    description: 'Long-exposure photography from the Singapore night race: 1,600 lighting rigs, one car, and a ribbon of light through the city. Printed on metallic pearl paper that makes the floodlights glow.' },
  // Collectibles
  { sku: 'PF-CO-001', name: 'Podium Champagne — Signed Magnum', cat: 'collectibles', price: 89900, stock: 3, rating: 4.9, ratingCount: 15, badge: 'Signed',
    description: 'An empty podium magnum from a 2022 race weekend, sprayed on the rostrum and signed by all three finishers before it left the room. Display case, podium photo and authentication included.' },
  { sku: 'PF-CO-002', name: 'Pit Board — Final Lap Display', cat: 'collectibles', price: 49900, stock: 5, rating: 4.8, ratingCount: 23,
    description: 'A genuine carbon pit board hung over the wall on the final lap of a 2021 victory, still loaded with its last message: P1 — BOX THIS LAP IN. The most analogue piece of technology in modern F1.' },
  { sku: 'PF-CO-003', name: 'Team Cap — 2026 Limited Edition', cat: 'collectibles', price: 4500, stock: 60, rating: 4.4, ratingCount: 312, badge: 'New',
    description: 'The 2026 season team cap in a numbered limited run, with flat embroidery, a carbon-weave brim underside and the launch-livery colourway that sold out trackside in a weekend.' },
  { sku: 'PF-CO-004', name: 'Paddock Pass Collection 1984–1999', cat: 'collectibles', price: 39900, stock: 4, rating: 4.9, ratingCount: 31, featured: true,
    description: 'Sixteen seasons of laminated paddock passes from a working press photographer, framed chronologically — a pocket history of the sport’s golden era, from turbo monsters to grooved tyres.' },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function seedDatabase(db: Db) {
  const wipe = db.transaction(() => {
    db.exec(`
      DELETE FROM payments; DELETE FROM order_items; DELETE FROM orders;
      DELETE FROM cart_items; DELETE FROM carts;
      DELETE FROM products; DELETE FROM categories;
      DELETE FROM users; DELETE FROM newsletter_subscribers;
    `);
    try {
      db.exec('DELETE FROM sqlite_sequence');
    } catch {
      // sqlite_sequence doesn't exist until the first AUTOINCREMENT insert
    }
  });
  wipe();

  const insertCategory = db.prepare(
    'INSERT INTO categories (slug, name, description, image_seed) VALUES (?, ?, ?, ?)'
  );
  const categoryIds = new Map<string, number>();
  for (const c of categories) {
    const result = insertCategory.run(c.slug, c.name, c.description, c.seed);
    categoryIds.set(c.slug, Number(result.lastInsertRowid));
  }

  const insertProduct = db.prepare(`
    INSERT INTO products (sku, slug, name, description, price_cents, compare_at_cents,
      category_id, stock, rating, rating_count, badge, image_seed, featured, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);
  products.forEach((p, i) => {
    const slug = slugify(p.name);
    insertProduct.run(
      p.sku, slug, p.name, p.description, p.price, p.compareAt ?? null,
      categoryIds.get(p.cat), p.stock, p.rating, p.ratingCount,
      p.badge ?? null, slug, p.featured ? 1 : 0, `-${products.length - i} days`
    );
  });

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, datetime('now', ?))"
  );
  insertUser.run(DEMO_ACCOUNTS.admin.email, hash(DEMO_ACCOUNTS.admin.password), DEMO_ACCOUNTS.admin.name, 'admin', '-90 days');
  const avaId = Number(
    insertUser.run(DEMO_ACCOUNTS.customer.email, hash(DEMO_ACCOUNTS.customer.password), DEMO_ACCOUNTS.customer.name, 'customer', '-45 days').lastInsertRowid
  );
  const extraCustomers = [
    ['noah@demo.dev', 'Noah Okafor', '-38 days'],
    ['imani@demo.dev', 'Imani Walker', '-21 days'],
    ['lucas@demo.dev', 'Lucas Romero', '-9 days'],
  ] as const;
  const extraIds = extraCustomers.map(([email, name, ago]) =>
    Number(insertUser.run(email, hash('Customer123!'), name, 'customer', ago).lastInsertRowid)
  );

  // Seed historical orders so order history / admin views aren't empty.
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, user_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents,
      ship_name, ship_line1, ship_city, ship_postal, ship_country, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);
  const insertOrderItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, name, image_seed, price_cents, qty) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertPayment = db.prepare(`
    INSERT INTO payments (id, order_id, status, amount_cents, card_brand, card_last4, created_at)
    VALUES (?, ?, 'succeeded', ?, 'visa', '4242', datetime('now', ?))
  `);
  const productRows = db.prepare('SELECT id, name, slug, price_cents FROM products').all() as
    { id: number; name: string; slug: string; price_cents: number }[];
  const byIndex = (i: number) => productRows[i];

  const demoOrders: { id: string; userId: number; items: [number, number][]; status: string; ago: string; name: string }[] = [
    { id: 'PF-1A7F2K', userId: avaId, items: [[0, 1], [18, 2]], status: 'delivered', ago: '-30 days', name: DEMO_ACCOUNTS.customer.name },
    { id: 'PF-3C9D4M', userId: avaId, items: [[9, 1]], status: 'shipped', ago: '-6 days', name: DEMO_ACCOUNTS.customer.name },
    { id: 'PF-5E2G8P', userId: extraIds[0], items: [[16, 1], [22, 2]], status: 'delivered', ago: '-19 days', name: extraCustomers[0][1] },
    { id: 'PF-7H4J1R', userId: extraIds[1], items: [[13, 1]], status: 'paid', ago: '-2 days', name: extraCustomers[1][1] },
    { id: 'PF-9K6L3T', userId: extraIds[2], items: [[23, 1], [19, 1]], status: 'paid', ago: '-1 days', name: extraCustomers[2][1] },
  ];

  const seedOrders = db.transaction(() => {
    for (const o of demoOrders) {
      const subtotal = o.items.reduce((sum, [idx, qty]) => sum + byIndex(idx).price_cents * qty, 0);
      const shipping = subtotal >= 25000 ? 0 : 800;
      const tax = Math.round(subtotal * 0.08);
      const total = subtotal + shipping + tax;
      insertOrder.run(o.id, o.userId, o.status, subtotal, shipping, tax, total,
        o.name, '14 Foundry Lane', 'Portland', '97209', 'United States', o.ago);
      for (const [idx, qty] of o.items) {
        const p = byIndex(idx);
        insertOrderItem.run(o.id, p.id, p.name, p.slug, p.price_cents, qty);
      }
      insertPayment.run(`pay_${o.id.toLowerCase().replace('-', '')}`, o.id, total, o.ago);
    }
  });
  seedOrders();

  return {
    categories: categories.length,
    products: products.length,
    users: 2 + extraCustomers.length,
    orders: demoOrders.length,
  };
}
