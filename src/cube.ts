/**
 * A tiny 3x3 sticker simulator, used to work out what each PLL looks like.
 *
 * Each case is defined by a standard algorithm that solves it. Running that algorithm
 * backwards on a solved cube gives the case. We then read the 12 side stickers of the
 * top layer, which is all that recognition needs (the top face is always yellow).
 *
 * Kept free of DOM and app imports so scripts/generate-cubes.ts can run it under plain Node.
 */

export type Color = "yellow" | "white" | "blue" | "red" | "green" | "orange";

/** Side colors in order around the cube, each one to the right of the previous (yellow on top). */
export const SIDE_COLORS = ["blue", "red", "green", "orange"] as const;
export type SideColor = (typeof SIDE_COLORS)[number];

type Vec = [number, number, number];
interface Sticker {
  pos: Vec;
  normal: Vec;
  color: Color;
}

// x = right, y = up, z = front. Solved cube: blue front, red right (Western scheme, yellow up).
const FACE_COLORS: [Vec, Color][] = [
  [[0, 1, 0], "yellow"],
  [[0, -1, 0], "white"],
  [[0, 0, 1], "blue"],
  [[1, 0, 0], "red"],
  [[0, 0, -1], "green"],
  [[-1, 0, 0], "orange"],
];

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Quarter turn clockwise, as seen looking at the face from outside along `axis`. */
function quarterTurn(v: Vec, axis: Vec): Vec {
  const c = cross(axis, v);
  const d = dot(axis, v);
  return [axis[0] * d - c[0], axis[1] * d - c[1], axis[2] * d - c[2]];
}

function solved(): Sticker[] {
  const stickers: Sticker[] = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++)
        for (const [normal, color] of FACE_COLORS) {
          const pos: Vec = [x, y, z];
          if (dot(pos, normal) === 1) stickers.push({ pos, normal, color });
        }
  return stickers;
}

/** Move letter → turning axis and which layers (by coordinate along that axis) it moves. */
const MOVES: Record<string, { axis: Vec; layers: number[] }> = {
  R: { axis: [1, 0, 0], layers: [1] },
  L: { axis: [-1, 0, 0], layers: [1] },
  U: { axis: [0, 1, 0], layers: [1] },
  D: { axis: [0, -1, 0], layers: [1] },
  F: { axis: [0, 0, 1], layers: [1] },
  B: { axis: [0, 0, -1], layers: [1] },
  M: { axis: [-1, 0, 0], layers: [0] }, // follows L
  E: { axis: [0, -1, 0], layers: [0] }, // follows D
  S: { axis: [0, 0, 1], layers: [0] }, // follows F
  r: { axis: [1, 0, 0], layers: [1, 0] },
  l: { axis: [-1, 0, 0], layers: [1, 0] },
  u: { axis: [0, 1, 0], layers: [1, 0] },
  d: { axis: [0, -1, 0], layers: [1, 0] },
  f: { axis: [0, 0, 1], layers: [1, 0] },
  b: { axis: [0, 0, -1], layers: [1, 0] },
  x: { axis: [1, 0, 0], layers: [1, 0, -1] },
  y: { axis: [0, 1, 0], layers: [1, 0, -1] },
  z: { axis: [0, 0, 1], layers: [1, 0, -1] },
};

interface Move {
  letter: string;
  turns: 1 | 2 | 3;
}

export function parseAlg(alg: string): Move[] {
  return alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const m = /^([RLUDFBMESrludfbxyz])(2|'|2')?$/.exec(token);
      if (!m) throw new Error(`Unknown move "${token}"`);
      const turns = m[2] === "'" ? 3 : m[2] ? 2 : 1;
      return { letter: m[1], turns };
    });
}

export function invertAlg(moves: Move[]): Move[] {
  return [...moves].reverse().map((m) => ({ letter: m.letter, turns: (4 - m.turns) as Move["turns"] }));
}

function apply(stickers: Sticker[], moves: Move[]): Sticker[] {
  let state = stickers;
  for (const { letter, turns } of moves) {
    const { axis, layers } = MOVES[letter];
    state = state.map((s) => {
      if (!layers.includes(dot(s.pos, axis))) return s;
      let { pos, normal } = s;
      for (let i = 0; i < turns; i++) {
        pos = quarterTurn(pos, axis);
        normal = quarterTurn(normal, axis);
      }
      return { pos, normal, color: s.color };
    });
  }
  return state;
}

/**
 * The 12 top-layer side stickers, as 4 sides × [left, middle, right] seen facing each side.
 * Sides go front, right, back, left, so side i+1 is always to the right of side i.
 */
export type TopRing = [Color, Color, Color][];

// For each side: its normal, and the coordinate axis that runs left → right when you face it.
const SIDES: { normal: Vec; across: Vec }[] = [
  { normal: [0, 0, 1], across: [1, 0, 0] },
  { normal: [1, 0, 0], across: [0, 0, -1] },
  { normal: [0, 0, -1], across: [-1, 0, 0] },
  { normal: [-1, 0, 0], across: [0, 0, 1] },
];

function readTopRing(stickers: Sticker[]): TopRing {
  return SIDES.map(({ normal, across }) => {
    const row = stickers
      .filter((s) => s.pos[1] === 1 && dot(s.normal, normal) === 1)
      .sort((a, b) => dot(a.pos, across) - dot(b.pos, across));
    return row.map((s) => s.color) as [Color, Color, Color];
  });
}

/** True if only the top layer is disturbed and the top face is still all yellow, i.e. a pure PLL. */
export function isPll(alg: string): boolean {
  const state = apply(solved(), invertAlg(parseAlg(alg)));
  const reference = solved();
  return state.every((s) => {
    if (s.pos[1] === 1 && s.normal[1] === 1) return s.color === "yellow";
    if (s.pos[1] === 1) return true;
    const home = reference.find((r) => r.pos.join() === s.pos.join() && r.normal.join() === s.normal.join());
    return home?.color === s.color;
  });
}

export function topRingFor(alg: string): TopRing {
  return readTopRing(apply(solved(), invertAlg(parseAlg(alg))));
}

/**
 * Standard algorithms. Each one solves its case, so running it backwards sets the case up.
 * Names follow the common convention (and the original picture set's file names).
 */
export const PLL_ALGS: Record<string, string> = {
  Aa: "x R' U R' D2 R U' R' D2 R2 x'",
  Ab: "x R2 D2 R U R' D2 R U' R x'",
  E: "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
  F: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
  Ga: "R2 U R' U R' U' R U' R2 U' D R' U R D'",
  Gb: "R' U' R U D' R2 U R' U R U' R U' R2 D",
  Gc: "R2 U' R U' R U R' U R2 U D' R U' R' D",
  Gd: "R U R' U' D R2 U' R U' R' U R' U R2 D'",
  H: "M2 U M2 U2 M2 U M2",
  Ja: "L' U' L F L' U' L U L F' L2 U L",
  Jb: "R U R' F' R U R' U' R' F R2 U' R'",
  Na: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
  Nb: "R' U R U' R' F' U' F R U R' F R' F' R U' R",
  Ra: "R U' R' U' R U R D R' U' R D' R' U2 R'",
  Rb: "R2 F R U R U' R' F' R U2 R' U2 R",
  T: "R U R' U' R' F R2 U' R' U' R U R' F'",
  Ua: "M2 U M U2 M' U M2",
  Ub: "M2 U' M U2 M' U' M2",
  V: "R' U R' U' y R' F' R2 U' R' U R' F R F y'", // trailing y' undoes the mid-alg rotation
  Y: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  Z: "M' U M2 U M2 U M' U2 M2",
};

export const ANGLES = [1, 2, 3, 4] as const;

/** What one picture shows: the front and right faces' top rows (3 stickers each). */
export interface View {
  front: [Color, Color, Color];
  right: [Color, Color, Color];
}

/**
 * One case seen from one angle with one color rotation.
 * - angle 1–4: which side of the top layer faces you (equivalent to a U turn before recognizing).
 * - color: which side color sits where blue is in the reference scheme. Rotating colors keeps the
 *   scheme's order (blue → red → green → orange), so every picture is a real cube.
 */
export function viewOf(ring: TopRing, color: SideColor, angle: number): View {
  const shift = SIDE_COLORS.indexOf(color);
  const recolor = (c: Color): Color =>
    (SIDE_COLORS as readonly Color[]).includes(c) ? SIDE_COLORS[(SIDE_COLORS.indexOf(c as SideColor) + shift) % 4] : c;
  const side = (i: number) => ring[i % 4].map(recolor) as [Color, Color, Color];
  return { front: side(angle - 1), right: side(angle) };
}

export const viewKey = (v: View) => [...v.front, ...v.right].join(",");
