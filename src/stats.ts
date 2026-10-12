import type { CaseId, PllCase } from "./cases";

export interface CaseStats {
  /** Times the case was shown and answered. */
  n: number;
  /** Times it was answered correctly. */
  ok: number;
  /** Recognition times (ms) of the most recent correct answers. */
  times: number[];
  /** Wrong answers given for this case, by the case that was guessed. */
  confused: Record<CaseId, number>;
}

export type StatsMap = Record<CaseId, CaseStats>;

export type Mode = "random" | "weak";

export const MAX_TIMES = 20;

/** Cases with fewer attempts than this get a flat high weight in weak mode, so they get data quickly. */
const MIN_ATTEMPTS = 3;

export function emptyStats(): CaseStats {
  return { n: 0, ok: 0, times: [], confused: {} };
}

export function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function recordAnswer(stats: StatsMap, actual: CaseId, guess: CaseId, ms: number): void {
  const s = (stats[actual] ??= emptyStats());
  s.n++;
  if (guess === actual) {
    s.ok++;
    s.times.push(Math.round(ms));
    if (s.times.length > MAX_TIMES) s.times.shift();
  } else {
    s.confused[guess] = (s.confused[guess] ?? 0) + 1;
  }
}

/** Mean recognition time over every stored correct answer, across all cases. */
export function overallAverage(stats: StatsMap): number | null {
  return average(Object.values(stats).flatMap((s) => s.times));
}

/**
 * How often a case should come up in weak mode, relative to others.
 * Baseline 1, plus a lot for misses, plus some for being slower than your overall average.
 */
export function weightFor(stats: StatsMap, id: CaseId): number {
  const s = stats[id];
  if (!s || s.n < MIN_ATTEMPTS) return 3;
  const errorRate = 1 - s.ok / s.n;
  const overall = overallAverage(stats) ?? 1500;
  const mine = average(s.times) ?? overall * 1.5;
  return 1 + errorRate * 6 + Math.max(0, mine / overall - 0.7) * 3;
}

/** Picks the next case from `pool`, never repeating `previous` unless it's the only option. */
export function pickCase(
  pool: CaseId[],
  previous: CaseId | null,
  mode: Mode,
  stats: StatsMap,
  random: () => number = Math.random,
): CaseId {
  if (pool.length === 0) throw new Error("pickCase: empty pool");
  const candidates = pool.length > 1 ? pool.filter((id) => id !== previous) : pool;
  if (mode === "random") return candidates[Math.floor(random() * candidates.length)];

  const weights = candidates.map((id) => weightFor(stats, id));
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export type Tag = "new" | "misses" | "slow" | null;
export type SortKey = "name" | "avg" | "acc" | "n";

export interface StatsRow {
  id: CaseId;
  n: number;
  /** 0..1, null if never seen. */
  accuracy: number | null;
  /** ms, null if never answered correctly. */
  avgMs: number | null;
  /** Most common wrong answer, e.g. { id: "J", count: 2 }. */
  topConfusion: { id: CaseId; count: number } | null;
  tag: Tag;
}

export function buildRows(stats: StatsMap, cases: PllCase[]): StatsRow[] {
  const rows = cases.map((c) => {
    const s = stats[c.id] ?? emptyStats();
    const top = Object.entries(s.confused).sort((a, b) => b[1] - a[1])[0];
    return {
      id: c.id,
      n: s.n,
      accuracy: s.n ? s.ok / s.n : null,
      avgMs: average(s.times),
      topConfusion: top ? { id: top[0], count: top[1] } : null,
      tag: null as Tag,
    };
  });
  const overall = average(rows.flatMap((r) => (r.avgMs == null ? [] : [r.avgMs])));
  for (const r of rows) r.tag = tagFor(r, overall);
  return rows;
}

function tagFor(row: Omit<StatsRow, "tag">, overallMs: number | null): Tag {
  if (row.n === 0) return "new";
  if (row.accuracy != null && row.accuracy < 0.8 && row.n >= MIN_ATTEMPTS) return "misses";
  if (overallMs && row.avgMs && row.avgMs > overallMs * 1.3) return "slow";
  return null;
}

/** Sorts worst-first for avg/acc, most-seen first for n, original order for name. Returns a new array. */
export function sortRows(rows: StatsRow[], key: SortKey, order: CaseId[]): StatsRow[] {
  const out = [...rows];
  switch (key) {
    case "name":
      return out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    case "avg":
      return out.sort((a, b) => (b.avgMs ?? -1) - (a.avgMs ?? -1));
    case "acc":
      return out.sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2));
    case "n":
      return out.sort((a, b) => b.n - a.n);
  }
}
