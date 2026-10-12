import { SIDE_COLORS, type Color, type View } from "./cube.ts";

/**
 * Two-sided PLL recognition, following Mark49152's Two-Sided PLL Recognition Guide (v2014.05.31).
 *
 * The guide lives here twice: as data for the popover (GUIDE), and as code (recognize) that
 * applies the same patterns in the same order. The tests run recognize() on all 336 pictures,
 * which checks this transcription of the guide names the right PLL every time.
 *
 * Stickers are read as one row of six: the left side's three, then the right side's three.
 * The two middle stickers meet at the front corner. Cases can appear mirrored, so every
 * pattern is also tried on the reversed row.
 */

export type Family = "A" | "E" | "F" | "G" | "H" | "J" | "N" | "R" | "T" | "U" | "V" | "Y" | "Z";

export interface Rule {
  id: string;
  /** Example strip: 6 letters, g/o/r/b for colors and "." for "doesn't matter". */
  strip: string;
  when: string;
  /** The answer as the guide writes it, e.g. "Ga/c". */
  label: string;
  then: Family;
}

export interface Pattern {
  title: string;
  strip: string;
  rules: Rule[];
}

export const CREDIT = {
  text: "Mark49152's Two-Sided PLL Recognition Guide",
  url: "https://cubing.pt/wp-content/uploads/2017/03/pll2side-20140531.pdf",
};

export const HOW_TO: string[] = [
  "Look for features in this order: 3-bar, then lights, then 2-bar, then bookends.",
  "Pick the first pattern below that matches, then the first case in it that matches.",
  "Each case comes in four color combinations and may be mirrored.",
  "opp = opposite color, adj = adjacent color, compared with the nearest pattern color.",
];

export const TERMS: [string, string][] = [
  ["3-bar", "a whole side in one color"],
  ["Lights", "headlights: both corners of a side match"],
  ["2-bar", "a corner and the edge next to it match"],
  ["Bookends", "the two outermost stickers match"],
  ["Checker", "two colors alternating along the row"],
  ["Inside / outside", "a bar next to the front corner / at the far end"],
];

const r = (id: string, strip: string, when: string, label: string): Rule => ({
  id,
  strip,
  when,
  label,
  then: label[0] as Family,
});

export const GUIDE: Pattern[] = [
  {
    title: "3-bar",
    strip: "ggg...",
    rules: [
      r("bar3-lights", "gggo.o", "headlights", "U"),
      r("bar3-bar2", "gggoo.", "2-bar", "J"),
      r("bar3-none", "gggorb", "4 colors", "F"),
    ],
  },
  {
    title: "Double lights",
    strip: "g.go.o",
    rules: [
      r("lights2-checker", "gogogo", "2-color 6-checker", "Z"),
      r("lights2-adj", "grgobo", "adj edges & 4 colors", "Z"),
      r("lights2-opp", "gbgoro", "opp edges", "H"),
      r("lights2-21", "g.gogo", "2:1 pattern & 3 colors", "U"),
    ],
  },
  {
    title: "Lights + 2-bar",
    strip: "g.goo.",
    rules: [
      r("lb-inside-3", "gbgoob", "inside bar & 3 colors", "T"),
      r("lb-inside-4", "grgoob", "inside bar & 4 colors", "R"),
      r("lb-outer-3", "gogobb", "outer bar & 3 colors", "A"),
      r("lb-outer-4", "grgobb", "outer bar & 4 colors", "Ga/c"),
    ],
  },
  {
    title: "Lone lights",
    strip: "g.g...",
    rules: [
      r("lone-5checker", "gogog.", "5-checker", "R"),
      r("lone-4checker", "gogo..", "4-checker", "Ga/c"),
      r("lone-opp", "gbg...", "lights enclose opp", "Gb/d"),
      r("lone-adj", "grg...", "lights enclose adj (but no checker)", "A"),
    ],
  },
  {
    title: "Double 2-bar",
    strip: "gg.oo.",
    rules: [
      r("bars-outside", "gg..oo", "both outside", "Y"),
      r("bars-inside-bookends", "bggoob", "both inside & bookends", "A"),
      r("bars-inside", "bggoor", "inside & no bookends", "V"),
      r("bars-same-bookends", "gg.rrg", "same side & bookends", "J"),
      r("bars-same", "gg.rro", "same side & no bookends", "N"),
    ],
  },
  {
    title: "Outside 2-bar",
    strip: "gg....",
    rules: [
      r("out-nobookend", "gg...o", "no bookends", "V"),
      r("out-adj-twice", "ggo.og", "adj appears twice", "R"),
      r("out-opp-twice", "ggb.bg", "opp appears twice", "Gb/d"),
      r("out-adj-bar", "ggo..g", "adj by bar & 4 colors", "T"),
      r("out-opp-bar", "ggb..g", "opp by bar & 4 colors", "A"),
    ],
  },
  {
    title: "Inside 2-bar",
    strip: ".gg...",
    rules: [
      r("in-bookends-adj", "rgg..r", "bookends adj color", "Ga/c"),
      r("in-bookends-opp", "bgg..b", "bookends opp color", "Gb/d"),
      r("in-nobookends", "bgg..r", "no bookends", "Y"),
    ],
  },
  {
    title: "Bookends, no bar",
    strip: "g....g",
    rules: [
      r("be-checker", "grbrbg", "enclosed 4-checker", "F"),
      r("be-adj-twice", "gr.r.g", "adj appears twice", "R"),
      r("be-opp-twice", "gb.b.g", "opp appears twice", "Ga/c"),
    ],
  },
  {
    title: "No bookends",
    strip: "g....o",
    rules: [
      r("nb-inner", "grbrbo", "inner 4-checker", "V"),
      r("nb-outer", "go..go", "outer 4-checker", "Y"),
      r("nb-5checker", "grbrgo", "5-checker with opp middle", "E"),
    ],
  },
];

const RULES: Record<string, Rule> = Object.fromEntries(GUIDE.flatMap((p) => p.rules.map((x) => [x.id, x])));

type Row = Color[];

const isOpp = (a: Color, b: Color) =>
  Math.abs(SIDE_COLORS.indexOf(a as (typeof SIDE_COLORS)[number]) - SIDE_COLORS.indexOf(b as (typeof SIDE_COLORS)[number])) === 2;
const colorCount = (s: Row) => new Set(s).size;

// Side shapes on a row: left side is s[0..2], right side is s[3..5].
const bar3L = (s: Row) => s[0] === s[1] && s[1] === s[2];
const lightsL = (s: Row) => s[0] === s[2] && s[0] !== s[1];
const lightsR = (s: Row) => s[3] === s[5] && s[3] !== s[4];
const outerBarL = (s: Row) => s[0] === s[1] && s[1] !== s[2];
const innerBarL = (s: Row) => s[1] === s[2] && s[0] !== s[1];
const innerBarR = (s: Row) => s[3] === s[4] && s[4] !== s[5];
const outerBarR = (s: Row) => s[4] === s[5] && s[3] !== s[4];
const bar2L = (s: Row) => outerBarL(s) || innerBarL(s);
const bar2R = (s: Row) => innerBarR(s) || outerBarR(s);
const plainL = (s: Row) => s[0] !== s[1] && s[1] !== s[2] && s[0] !== s[2];
const plainR = (s: Row) => s[3] !== s[4] && s[4] !== s[5] && s[3] !== s[5];

/** Each pattern: does it match this row (left side = the pattern side), and if so which rule decides. */
const PATTERNS: ((s: Row) => string | null)[] = [
  // 3-bar
  (s) => {
    if (!bar3L(s)) return null;
    if (lightsR(s)) return "bar3-lights";
    if (bar2R(s)) return "bar3-bar2";
    return "bar3-none";
  },
  // Double lights
  (s) => {
    if (!lightsL(s) || !lightsR(s)) return null;
    if (s[1] === s[3] && s[4] === s[0]) return "lights2-checker";
    if (!isOpp(s[0], s[1]) && !isOpp(s[3], s[4]) && colorCount(s) === 4) return "lights2-adj";
    if (isOpp(s[0], s[1]) && isOpp(s[3], s[4])) return "lights2-opp";
    if ((s[4] === s[0] || s[1] === s[3]) && colorCount(s) === 3) return "lights2-21";
    return null;
  },
  // Lights + 2-bar
  (s) => {
    if (!lightsL(s) || !bar2R(s)) return null;
    const c = colorCount(s);
    if (innerBarR(s)) return c === 3 ? "lb-inside-3" : "lb-inside-4";
    return c === 3 ? "lb-outer-3" : "lb-outer-4";
  },
  // Lone lights
  (s) => {
    if (!lightsL(s) || !plainR(s)) return null;
    if (s[3] === s[1] && s[4] === s[0]) return "lone-5checker";
    if (s[3] === s[1]) return "lone-4checker";
    return isOpp(s[0], s[1]) ? "lone-opp" : "lone-adj";
  },
  // Double 2-bar
  (s) => {
    if (!bar2L(s) || !bar2R(s)) return null;
    const bookends = s[0] === s[5];
    if (outerBarL(s) && outerBarR(s)) return "bars-outside";
    if (innerBarL(s) && innerBarR(s)) return bookends ? "bars-inside-bookends" : "bars-inside";
    return bookends ? "bars-same-bookends" : "bars-same";
  },
  // Outside 2-bar
  (s) => {
    if (!outerBarL(s) || !plainR(s)) return null;
    if (s[5] !== s[0]) return "out-nobookend";
    if (s[2] === s[4]) return isOpp(s[0], s[2]) ? "out-opp-twice" : "out-adj-twice";
    if (colorCount(s) === 4) return isOpp(s[0], s[2]) ? "out-opp-bar" : "out-adj-bar";
    return null;
  },
  // Inside 2-bar
  (s) => {
    if (!innerBarL(s) || !plainR(s)) return null;
    if (s[0] !== s[5]) return "in-nobookends";
    return isOpp(s[0], s[1]) ? "in-bookends-opp" : "in-bookends-adj";
  },
  // Bookends, no bar
  (s) => {
    if (!plainL(s) || !plainR(s) || s[0] !== s[5]) return null;
    if (s[1] === s[3] && s[2] === s[4]) return "be-checker";
    const inner = s.slice(1, 5);
    const twice = inner.find((c, i) => inner.indexOf(c) !== i);
    if (!twice) return null;
    return isOpp(s[0], twice) ? "be-opp-twice" : "be-adj-twice";
  },
  // No bookends
  (s) => {
    if (!plainL(s) || !plainR(s) || s[0] === s[5]) return null;
    if (s[1] === s[3] && s[2] === s[4]) return "nb-inner";
    if (s[0] === s[4] && s[1] === s[5]) return "nb-outer";
    if (s[0] === s[4] && s[1] === s[3] && isOpp(s[0], s[2])) return "nb-5checker";
    return null;
  },
];

/** Names the PLL in a picture by applying the guide's patterns in order, each also mirrored. */
export function recognize({ front, right }: View): Rule | null {
  const row: Row = [...front, ...right];
  const mirrored: Row = [...row].reverse();
  for (const test of PATTERNS) {
    const id = test(row) ?? test(mirrored);
    if (id) return RULES[id];
  }
  return null;
}
