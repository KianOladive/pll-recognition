import type { Color, View } from "./cube.ts";

/**
 * Draws a View as an SVG: an isometric cube showing the top face, the front face (left in the
 * picture) and the right face. Only the top row of each side is colored; the two layers below
 * are dark, matching the original picture set. Colors are taken from those pictures.
 */

export const FILL: Record<Color, string> = {
  yellow: "#FDFD00",
  blue: "#0000F1",
  red: "#ED0000",
  green: "#00D800",
  orange: "#FEA000",
  white: "#FFFFFF",
};
const HIDDEN = "#404040";
const BODY = "#000000";

type Pt = [number, number];

const SIZE = 200;
const S = 30; // one sticker's edge length
const DX = S * Math.cos(Math.PI / 6);
const DY = S * Math.sin(Math.PI / 6);
const TOP: Pt = [SIZE / 2, (SIZE - 6 * DY - 3 * S) / 2]; // back corner of the top face

// Screen directions for one sticker step: along the top face to the right, to the left, and down a side.
const U: Pt = [DX, DY];
const V: Pt = [-DX, DY];
const W: Pt = [0, S];
const NEG_V: Pt = [DX, -DY];

const at = (base: Pt, ...steps: [Pt, number][]): Pt =>
  steps.reduce<Pt>((p, [dir, n]) => [p[0] + dir[0] * n, p[1] + dir[1] * n], base);

const fmt = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

function quad(origin: Pt, a: Pt, b: Pt, fill: string, inset: number, stroke: number): string {
  const lo = inset;
  const hi = 1 - inset;
  const pts = [at(origin, [a, lo], [b, lo]), at(origin, [a, hi], [b, lo]), at(origin, [a, hi], [b, hi]), at(origin, [a, lo], [b, hi])];
  return `<polygon points="${pts.map(fmt).join(" ")}" fill="${fill}" stroke="${fill}" stroke-width="${stroke}" stroke-linejoin="round"/>`;
}

const STICKER_INSET = 0.12;
const STICKER_ROUND = 3;

export function renderSvg(view: View, title = ""): string {
  const parts: string[] = [];
  const frontOrigin = at(TOP, [V, 3]);
  const rightOrigin = at(TOP, [U, 3], [V, 3]); // the corner nearest the viewer

  // Cube body (black), drawn as three faces so the outline is continuous.
  parts.push(polygon([TOP, at(TOP, [U, 3]), at(TOP, [U, 3], [V, 3]), at(TOP, [V, 3])]));
  parts.push(polygon([frontOrigin, at(frontOrigin, [U, 3]), at(frontOrigin, [U, 3], [W, 3]), at(frontOrigin, [W, 3])]));
  parts.push(polygon([rightOrigin, at(rightOrigin, [NEG_V, 3]), at(rightOrigin, [NEG_V, 3], [W, 3]), at(rightOrigin, [W, 3])]));

  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) parts.push(quad(at(TOP, [U, i], [V, j]), U, V, FILL.yellow, STICKER_INSET, STICKER_ROUND));

  for (let col = 0; col < 3; col++)
    for (let row = 0; row < 3; row++) {
      const front = row === 0 ? FILL[view.front[col]] : HIDDEN;
      const right = row === 0 ? FILL[view.right[col]] : HIDDEN;
      parts.push(quad(at(frontOrigin, [U, col], [W, row]), U, W, front, STICKER_INSET, STICKER_ROUND));
      parts.push(quad(at(rightOrigin, [NEG_V, col], [W, row]), NEG_V, W, right, STICKER_INSET, STICKER_ROUND));
    }

  const titleTag = title ? `<title>${title}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${titleTag}${parts.join("")}</svg>\n`;
}

function polygon(pts: Pt[]): string {
  return `<polygon points="${pts.map(fmt).join(" ")}" fill="${BODY}" stroke="${BODY}" stroke-width="4" stroke-linejoin="round"/>`;
}
