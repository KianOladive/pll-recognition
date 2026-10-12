import { describe, expect, it } from "vitest";
import { createStore } from "./storage";

const memory = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

describe("createStore", () => {
  it("round-trips JSON under a prefixed key", () => {
    const backend = memory();
    const store = createStore(backend);
    store.set("stats", { H: 1 });
    expect(backend.data.get("pllrt:stats")).toBe('{"H":1}');
    expect(store.get("stats", {})).toEqual({ H: 1 });
  });

  it("returns the fallback when nothing is stored", () => {
    expect(createStore(memory()).get("mode", "random")).toBe("random");
  });

  it("returns the fallback for corrupt data", () => {
    const backend = memory();
    backend.data.set("pllrt:stats", "{not json");
    expect(createStore(backend).get("stats", "fallback")).toBe("fallback");
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const store = createStore(blocked);
    expect(() => store.set("x", 1)).not.toThrow();
    expect(store.get("x", 0)).toBe(0);
  });

  it("works with no storage at all", () => {
    const store = createStore(null);
    store.set("x", 1);
    expect(store.get("x", 0)).toBe(0);
  });
});
