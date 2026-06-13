import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { openapiSpec } from './openapi.js';

// Exports the runtime OpenAPI spec (defined in openapi.ts) to static files
// so external tooling — Postman, codegen, API gateways, discovery/scanning
// tools — can consume it without the server running.
//
//   npm run spec      (from repo root or server/)
//
// Re-run after editing openapi.ts so the static files never drift.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..'); // server/
const jsonPath = path.join(outDir, 'openapi.json');
const yamlPath = path.join(outDir, 'openapi.yaml');

const spec = openapiSpec as unknown as Record<string, unknown>;

fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + '\n');
fs.writeFileSync(yamlPath, yaml.dump(spec, { lineWidth: 120, noRefs: true, sortKeys: false }));

const pathCount = Object.keys(openapiSpec.paths).length;
let operationCount = 0;
for (const item of Object.values(openapiSpec.paths)) {
  operationCount += Object.keys(item).length;
}

console.log(`✔ OpenAPI ${openapiSpec.openapi} — ${pathCount} paths, ${operationCount} operations`);
console.log(`  ${path.relative(process.cwd(), jsonPath)}`);
console.log(`  ${path.relative(process.cwd(), yamlPath)}`);
