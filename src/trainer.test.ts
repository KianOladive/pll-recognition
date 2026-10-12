import { beforeEach, describe, expect, it } from "vitest";
import { BY_ID } from "./cases";
import { Trainer } from "./trainer";

let clock = 0;
const make = (enabled = ["H", "Z", "G"]) =>
  new Trainer({ stats: {}, enabled: new Set(enabled), mode: "random", now: () => clock });

/** Starts the trainer and simulates the picture rendering. */
const startShown = (t: Trainer) => {
  const pic = t.start()!;
  t.markShown();
  return pic;
};

beforeEach(() => {
  clock = 1000;
});

describe("Trainer", () => {
  it("shows nothing until started", () => {
    const t = make();
    expect(t.running).toBe(false);
    expect(t.current).toBeNull();
    expect(t.answer("H")).toBeNull();
  });

  it("start returns a picture from an enabled case, with a valid file and angle", () => {
    const t = make(["G"]);
    const pic = t.start()!;
    expect(pic.caseId).toBe("G");
    expect(BY_ID.G.files).toContain(pic.file);
    expect(pic.angle).toBeGreaterThanOrEqual(1);
    expect(pic.angle).toBeLessThanOrEqual(4);
  });

  it("start is a no-op while running", () => {
    const t = make();
    const first = t.start();
    expect(t.start()).toBeNull();
    expect(t.current).toBe(first);
  });

  it("ignores answers before the picture has rendered", () => {
    const t = make();
    t.start();
    expect(t.answer("H")).toBeNull();
  });

  it("times from markShown, not from start", () => {
    const t = make();
    const pic = t.start()!;
    clock = 1500; // image took 500ms to load
    t.markShown();
    clock = 2300;
    const r = t.answer(pic.caseId)!;
    expect(r.ms).toBe(800);
  });

  it("a correct answer updates session and stats and does not wait", () => {
    const t = make();
    const pic = startShown(t);
    clock += 700;
    const r = t.answer(pic.caseId)!;
    expect(r.correct).toBe(true);
    expect(t.waiting).toBe(false);
    expect(t.session).toEqual({ n: 1, ok: 1, totalMs: 700, streak: 1 });
    expect(t.stats[pic.caseId].times).toEqual([700]);
  });

  it("a wrong answer waits and blocks further answers until next()", () => {
    const t = make(["H", "Z"]);
    const pic = startShown(t);
    const wrong = pic.caseId === "H" ? "Z" : "H";
    expect(t.answer(wrong)!.correct).toBe(false);
    expect(t.waiting).toBe(true);
    expect(t.session.streak).toBe(0);
    expect(t.answer(pic.caseId)).toBeNull();
    t.next();
    expect(t.waiting).toBe(false);
  });

  it("a fresh start resets the session but keeps stats", () => {
    const t = make();
    const pic = startShown(t);
    t.answer(pic.caseId);
    t.stop();
    t.start();
    expect(t.session.n).toBe(0);
    expect(t.stats[pic.caseId].n).toBe(1);
  });

  it("stop clears the current picture", () => {
    const t = make();
    startShown(t);
    t.stop();
    expect(t.running).toBe(false);
    expect(t.current).toBeNull();
    expect(t.next()).toBeNull();
  });

  it("is complete after `target` answers, right or wrong, and stops serving cases", () => {
    const t = new Trainer({ stats: {}, enabled: new Set(["H", "Z"]), mode: "random", target: 2, now: () => clock });
    let pic = startShown(t);
    t.answer(pic.caseId === "H" ? "Z" : "H"); // miss
    expect(t.complete).toBe(false);
    pic = t.next()!;
    t.markShown();
    t.answer(pic.caseId);
    expect(t.complete).toBe(true);
    expect(t.next()).toBeNull();
  });

  it("restarting a completed session starts over", () => {
    const t = new Trainer({ stats: {}, enabled: new Set(["H"]), mode: "random", target: 1, now: () => clock });
    const pic = startShown(t);
    t.answer(pic.caseId);
    t.stop();
    expect(t.start()).not.toBeNull();
    expect(t.complete).toBe(false);
  });

  it("endless sessions never complete", () => {
    const t = make(["H"]);
    startShown(t);
    for (let i = 0; i < 200; i++) {
      t.answer("H");
      t.next();
      t.markShown();
    }
    expect(t.complete).toBe(false);
  });

  it("won't remove the last enabled case", () => {
    const t = make(["H"]);
    expect(t.toggleCase("H")).toBe(false);
    expect(t.enabled.has("H")).toBe(true);
    expect(t.toggleCase("Z")).toBe(true);
    expect(t.toggleCase("H")).toBe(true);
    expect([...t.enabled]).toEqual(["Z"]);
  });
});
