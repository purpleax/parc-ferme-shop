import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';
import { seedDatabase } from './seed.js';

// Auto-seed on first run so a fresh checkout works without a manual step.
const productCount = (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n;
if (productCount === 0) {
  console.log('Empty database detected — seeding demo data...');
  seedDatabase(db);
}

const app = createApp();
app.listen(config.port, () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │   PARC FERMÉ — demo store API                │');
  console.log(`  │   http://localhost:${config.port}                        │`);
  console.log(`  │   Docs: http://localhost:${config.port}/api/docs         │`);
  console.log('  └──────────────────────────────────────────────┘');
  console.log('');
});
