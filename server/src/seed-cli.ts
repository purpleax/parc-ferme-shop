import { db } from './db.js';
import { config } from './config.js';
import { seedDatabase, DEMO_ACCOUNTS } from './seed.js';

const counts = seedDatabase(db);
console.log(`✔ Seeded ${config.dbPath}`);
console.log(`  ${counts.categories} categories, ${counts.products} products, ${counts.users} users, ${counts.orders} orders`);
console.log('\nDemo accounts:');
console.log(`  Admin:    ${DEMO_ACCOUNTS.admin.email} / ${DEMO_ACCOUNTS.admin.password}`);
console.log(`  Customer: ${DEMO_ACCOUNTS.customer.email} / ${DEMO_ACCOUNTS.customer.password}`);
