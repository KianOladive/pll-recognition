import { describe, expect, it } from "vitest";
import { CASES } from "./cases";
import {
  MAX_TIMES,
  average,
  buildRows,
  pickCase,
  recordAnswer,
  sortRows,
  weightFor,
  type CaseStats,
  type StatsMap,
} from "./stats";

const s = (n: number, ok: number, times: number[]): CaseStats => ({ n, ok, times, confused: {} });

/** Deterministic "random" that returns the given values in order, then repeats the last. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

describe("average", () => {
  it("returns null for no data", () => expect(average([])).toBeNull());
  it("computes the mean", () => expect(average([1000, 2000])).toBe(1500));
});

describe("recordAnswer", () => {
  it("counts a correct answer and stores its time", () => {
    const stats: StatsMap = {};
    recordAnswer(stats, "T", "T", 812.6);
    expect(stats.T).toEqual({ n: 1, ok: 1, times: [813], confused: {} });
  });

  it("counts a miss and remembers what it was mistaken for", () => {
    const stats: StatsMap = {};
    recordAnswer(stats, "J", "T", 900);
    recordAnswer(stats, "J", "T", 900);
    expect(stats.J).toEqual({ n: 2, ok: 0, times: [], confused: { T: 2 } });
  });

  it(`keeps only the last ${MAX_TIMES} times`, () => {
    const stats: StatsMap = {};
    for (let i = 1; i <= MAX_TIMES + 5; i++) recordAnswer(stats, "H", "H", i);
    expect(stats.H.times).toHaveLength(MAX_TIMES);
    expect(stats.H.times[0]).toBe(6);
  });
});

describe("weightFor", () => {
  it("gives unseen and barely-seen cases a high flat weight", () => {
    expect(weightFor({}, "G")).toBe(3);
    expect(weightFor({ G: s(2, 2, [500, 500]) }, "G")).toBe(3);
  });

  it("weights missed cases above clean ones at the same speed", () => {
    const stats = { H: s(10, 10, [1000]), Z: s(10, 5, [1000]) };
    expect(weightFor(stats, "Z")).toBeGreaterThan(weightFor(stats, "H"));
  });

  it("weights slow cases above fast ones at the same accuracy", () => {
    const stats = { H: s(10, 10, [600]), G: s(10, 10, [2400]) };
    expect(weightFor(stats, "G")).toBeGreaterThan(weightFor(stats, "H"));
  });
});

describe("pickCase", () => {
  it("never repeats the previous case when there's a choice", () => {
    for (let i = 0; i < 50; i++) {
      expect(pickCase(["H", "Z"], "H", "random", {}, Math.random)).toBe("Z");
    }
  });

  it("repeats when there's only one case", () => {
    expect(pickCase(["H"], "H", "random", {})).toBe("H");
  });

  it("random mode picks uniformly by index", () => {
    expect(pickCase(["H", "Z", "U"], null, "random", {}, seq(0.99))).toBe("U");
    expect(pickCase(["H", "Z", "U"], null, "random", {}, seq(0))).toBe("H");
  });

  it("weak mode lands on the heavy case for most of the range", () => {
    // H weight 1, G weight much higher: a roll just past H's share picks G.
    const stats = { H: s(10, 10, [500]), G: s(10, 2, [3000]) };
    const total = weightFor(stats, "H") + weightFor(stats, "G");
    const justPastH = (weightFor(stats, "H") + 0.01) / total;
    expect(pickCase(["H", "G"], null, "weak", stats, seq(justPastH))).toBe("G");
  });

  it("throws on an empty pool", () => {
    expect(() => pickCase([], null, "random", {})).toThrow();
  });
});

describe("buildRows / sortRows", () => {
  const stats: StatsMap = {
    H: s(10, 10, [600]),
    G: { n: 10, ok: 6, times: [2000], confused: { J: 3, R: 1 } },
    T: s(10, 10, [2400]),
  };
  const rows = buildRows(stats, CASES);
  const row = (id: string) => rows.find((r) => r.id === id)!;

  it("has one row per case", () => expect(rows).toHaveLength(CASES.length));

  it("tags unseen, missed and slow cases", () => {
    expect(row("Z").tag).toBe("new");
    expect(row("G").tag).toBe("misses");
    expect(row("T").tag).toBe("slow"); // 2400 vs overall ~1667, threshold 1.3x
    expect(row("H").tag).toBeNull();
  });

  it("reports the most common confusion", () => {
    expect(row("G").topConfusion).toEqual({ id: "J", count: 3 });
  });

  it("sorts slowest first by avg, with unseen cases last", () => {
    const sorted = sortRows(rows, "avg", CASES.map((c) => c.id));
    expect(sorted.slice(0, 3).map((r) => r.id)).toEqual(["T", "G", "H"]);
    expect(sorted.at(-1)!.avgMs).toBeNull();
  });

  it("sorts least accurate first by acc", () => {
    expect(sortRows(rows, "acc", [])[0].id).toBe("G");
  });

  it("does not mutate the input", () => {
    const before = rows.map((r) => r.id);
    sortRows(rows, "avg", []);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
