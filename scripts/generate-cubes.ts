// Writes every PLL picture to public/cubes/: 21 PLLs, each in 4 color rotations × 4 angles.
//
//   npm run cubes
//
// File names: <case>-<color>-<angle>.svg, e.g. Ga-red-3.svg. The files are committed, so the app
// serves them like any other static image; rerun this only after changing src/cube.ts or src/render.ts.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ANGLES, PLL_ALGS, SIDE_COLORS, isPll, topRingFor, viewOf } from "../src/cube.ts";
import { renderSvg } from "../src/render.ts";

const OUT = join(import.meta.dirname, "..", "public", "cubes");

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".svg")) rmSync(join(OUT, f));

let count = 0;
for (const [name, alg] of Object.entries(PLL_ALGS)) {
  if (!isPll(alg)) throw new Error(`${name}: algorithm doesn't produce a pure PLL`);
  const ring = topRingFor(alg);
  for (const color of SIDE_COLORS)
    for (const angle of ANGLES) {
      writeFileSync(join(OUT, `${name}-${color}-${angle}.svg`), renderSvg(viewOf(ring, color, angle), `${name} perm`));
      count++;
    }
}
console.log(`Wrote ${count} SVGs to public/cubes/`);
