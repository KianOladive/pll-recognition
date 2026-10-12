import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CASES } from "./cases";
import {
  ANGLES,
  PLL_ALGS,
  SIDE_COLORS,
  invertAlg,
  isPll,
  parseAlg,
  topRingFor,
  viewKey,
  viewOf,
  type SideColor,
  type View,
} from "./cube.ts";
import reference from "./fixtures/reference-views.json";
import { FILL, renderSvg } from "./render.ts";

const allViews = (name: string): View[] => {
  const ring = topRingFor(PLL_ALGS[name]);
  return SIDE_COLORS.flatMap((c) => ANGLES.map((a) => viewOf(ring, c, a)));
};

describe("parseAlg / invertAlg", () => {
  it("parses turns, primes and doubles", () => {
    expect(parseAlg("R U' F2 M2'")).toEqual([
      { letter: "R", turns: 1 },
      { letter: "U", turns: 3 },
      { letter: "F", turns: 2 },
      { letter: "M", turns: 2 },
    ]);
  });

  it("rejects unknown moves", () => {
    expect(() => parseAlg("R Q")).toThrow(/Q/);
  });

  it("inverts by reversing and flipping direction", () => {
    expect(invertAlg(parseAlg("R U' F2"))).toEqual(parseAlg("F2 U R'"));
  });
});

describe("the simulator", () => {
  it("an alg followed by its inverse changes nothing", () => {
    const alg = "R U F' D2 L B M E S x y z r u";
    const inverse = invertAlg(parseAlg(alg))
      .map((m) => m.letter + ["", "", "2", "'"][m.turns])
      .join(" ");
    expect(isPll(`${alg} ${inverse}`)).toBe(true);
    expect(topRingFor(`${alg} ${inverse}`)).toEqual(topRingFor(""));
  });

  it("knows a sexy-move setup is not a PLL", () => {
    expect(isPll("R U R' U'")).toBe(false);
  });

  it("the solved cube's top ring is each side's own color", () => {
    expect(topRingFor("")).toEqual(SIDE_COLORS.map((c) => [c, c, c]));
  });
});

describe("PLL algorithms", () => {
  it.each(Object.keys(PLL_ALGS))("%s only permutes the top layer", (name) => {
    expect(isPll(PLL_ALGS[name])).toBe(true);
  });

  it("covers all 21 PLLs", () => {
    expect(Object.keys(PLL_ALGS)).toHaveLength(21);
  });

  it("every variant used by the app has an algorithm", () => {
    for (const c of CASES) for (const f of c.files) expect(PLL_ALGS[f], f).toBeDefined();
  });

  it("no two PLLs ever look the same from two sides", () => {
    const owner = new Map<string, string>();
    for (const name of Object.keys(PLL_ALGS))
      for (const v of allViews(name)) {
        const key = viewKey(v);
        expect(owner.get(key) ?? name, `${name} vs ${owner.get(key)}`).toBe(name);
        owner.set(key, name);
      }
  });

  it("asymmetric cases have 16 different pictures; symmetric ones fewer", () => {
    const distinct = (name: string) => new Set(allViews(name).map(viewKey)).size;
    expect(distinct("T")).toBe(16);
    expect(distinct("Ga")).toBe(16);
    expect(distinct("Z")).toBe(8);
    expect(distinct("E")).toBe(8);
    expect(distinct("H")).toBe(4);
    expect(distinct("Na")).toBe(4);
  });
});

describe("matches the original picture set", () => {
  // Sticker colors read from the 84 original PLL GIFs (src/fixtures/reference-views.json).
  it.each(reference.map((r) => [r.picture, r] as const))("%s shows a view of its own case", (_, r) => {
    const key = [...r.front, ...r.right].join(",");
    expect(allViews(r.case).map(viewKey)).toContain(key);
  });
});

describe("viewOf", () => {
  it("rotating colors keeps the scheme's order", () => {
    const ring = topRingFor("");
    expect(viewOf(ring, "blue", 1)).toEqual({ front: ["blue", "blue", "blue"], right: ["red", "red", "red"] });
    expect(viewOf(ring, "green", 1)).toEqual({ front: ["green", "green", "green"], right: ["orange", "orange", "orange"] });
  });

  it("angle turns which side faces you", () => {
    const ring = topRingFor("");
    expect(viewOf(ring, "blue", 2).front).toEqual(["red", "red", "red"]);
    expect(viewOf(ring, "blue", 4).right).toEqual(["blue", "blue", "blue"]);
  });
});

describe("public/cubes", () => {
  it("every committed SVG is exactly what the generator would write today (run `npm run cubes` if not)", () => {
    const dir = join(__dirname, "..", "public", "cubes");
    const files = readdirSync(dir).filter((f) => f.endsWith(".svg"));
    expect(files).toHaveLength(Object.keys(PLL_ALGS).length * 16);
    for (const f of files) {
      const [, name, color, angle] = /^(\w+)-(\w+)-(\d)\.svg$/.exec(f)!;
      const expected = renderSvg(viewOf(topRingFor(PLL_ALGS[name]), color as SideColor, Number(angle)), `${name} perm`);
      expect(readFileSync(join(dir, f), "utf8"), f).toBe(expected);
    }
  });
});

describe("renderSvg", () => {
  const svg = renderSvg({ front: ["blue", "red", "green"], right: ["orange", "blue", "red"] }, "T perm");

  it("is a standalone SVG with a title", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).toContain("<title>T perm</title>");
  });

  it("draws 9 top stickers, 6 colored side stickers and 12 hidden ones", () => {
    const fills = [...svg.matchAll(/fill="(#[0-9A-F]{6})"/g)].map((m) => m[1]);
    const count = (hex: string) => fills.filter((f) => f === hex).length;
    expect(count(FILL.yellow)).toBe(9);
    expect(count("#404040")).toBe(12);
    expect(count(FILL.blue) + count(FILL.red) + count(FILL.green) + count(FILL.orange)).toBe(6);
  });
});
