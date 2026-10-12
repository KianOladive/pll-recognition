import { describe, expect, it } from "vitest";
import { ANGLES, PLL_ALGS, SIDE_COLORS, topRingFor, viewOf } from "./cube.ts";
import { GUIDE, recognize } from "./guide.ts";

const family = (variant: string) => (/^[AGJNRU][a-d]$/.test(variant) ? variant[0] : variant);

const everyPicture = Object.entries(PLL_ALGS).flatMap(([variant, alg]) => {
  const ring = topRingFor(alg);
  return SIDE_COLORS.flatMap((color) =>
    ANGLES.map((angle) => ({ variant, label: `${variant}-${color}-${angle}`, view: viewOf(ring, color, angle) })),
  );
});

describe("recognition guide", () => {
  it.each(everyPicture.map((p) => [p.label, p] as const))("names %s correctly", (_, p) => {
    expect(recognize(p.view)?.then).toBe(family(p.variant));
  });

  it("gets the G sub-case right where the guide names one (Ga/c vs Gb/d)", () => {
    for (const p of everyPicture.filter((p) => p.variant.startsWith("G"))) {
      const label = recognize(p.view)!.label;
      if (label === "Ga/c") expect(["Ga", "Gc"], p.label).toContain(p.variant);
      if (label === "Gb/d") expect(["Gb", "Gd"], p.label).toContain(p.variant);
    }
  });

  it("checks all 336 pictures", () => {
    expect(everyPicture).toHaveLength(336);
  });

  it("every rule in the guide is actually used by some picture", () => {
    const used = new Set(everyPicture.map((p) => recognize(p.view)?.id));
    const unused = GUIDE.flatMap((p) => p.rules.map((r) => r.id)).filter((id) => !used.has(id));
    expect(unused).toEqual([]);
  });

  it("rule ids are unique", () => {
    const ids = GUIDE.flatMap((p) => p.rules.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
