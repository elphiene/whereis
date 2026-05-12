/**
 * Generates PWA icon PNGs from public/icon.svg.
 * Run once before building:  bun run scripts/generate-icons.ts
 *
 * Requires: bun add -d @resvg/resvg-js
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const publicDir = join(import.meta.dir, '..', 'public');
const svg = readFileSync(join(publicDir, 'icon.svg'), 'utf-8');

const sizes = [192, 512] as const;

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
