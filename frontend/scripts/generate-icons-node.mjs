/**
 * Generates PWA icon PNGs from public/icon.svg.
 * Run once before building:
 *   bun run scripts/generate-icons.ts       (if bun is available)
 *   npm run generate:icons                  (uses node, works everywhere)
 *
 * Requires: @resvg/resvg-js (devDependency)
 */

import { Resvg } from './node_modules/@resvg/resvg-js/index.js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svg = readFileSync(join(publicDir, 'icon.svg'), 'utf-8');

const sizes = [192, 512];

for (const size of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: '#080808',
  });
  const pngData = resvg.render().asPng();
  const outPath = join(publicDir, `icon-${size}.png`);
  writeFileSync(outPath, pngData);
  console.log(`✓ icon-${size}.png  (${pngData.length} bytes)`);
}

console.log('Icons generated.');
