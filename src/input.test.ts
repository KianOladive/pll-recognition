import { describe, expect, it } from "vitest";
import { CASES } from "./cases";
import { AliasMatcher } from "./input";

const realAliases = () => new AliasMatcher(Object.fromEntries(CASES.map((c) => [c.alias, c.id])));

describe("AliasMatcher", () => {
  it("answers immediately on a single-letter alias", () => {
    const m = realAliases();
    expect(m.push("h")).toBe("H");
    expect(m.typed).toBe("");
  });

  it("is case-insensitive", () => {
    expect(realAliases().push("G")).toBe("G");
  });

  it("waits for more input when an alias has longer siblings", () => {
    const m = new AliasMatcher({ g: "G", ga: "Ga" });
    expect(m.push("g")).toBeNull();
    expect(m.typed).toBe("g");
    expect(m.push("a")).toBe("Ga");
  });

  it("restarts from the new letter after a dead end", () => {
    const m = new AliasMatcher({ ab: "AB", cd: "CD" });
    expect(m.push("a")).toBeNull();
    expect(m.push("c")).toBeNull(); // "ac" matches nothing, so the buffer becomes "c"
    expect(m.typed).toBe("c");
    expect(m.push("d")).toBe("CD");
  });

  it("drops letters that start no alias", () => {
    const m = realAliases();
    expect(m.push("q")).toBeNull();
    expect(m.typed).toBe("");
  });

  it("every real case has a unique, reachable alias", () => {
    const aliases = CASES.map((c) => c.alias);
    expect(new Set(aliases).size).toBe(aliases.length);
    for (const c of CASES) {
      const m = realAliases();
      const results = [...c.alias].map((ch) => m.push(ch));
      expect(results.at(-1)).toBe(c.id);
    }
  });
});
