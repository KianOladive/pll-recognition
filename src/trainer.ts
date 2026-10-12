import { ANGLES, BY_ID, COLORS, type CaseId } from "./cases";
import type { SideColor } from "./cube.ts";
import { pickCase, recordAnswer, type Mode, type StatsMap } from "./stats";

export interface Picture {
  caseId: CaseId;
  /** The specific PLL variant shown, e.g. "Gc" for the G answer. */
  file: string;
  color: SideColor;
  angle: number;
}

export interface AnswerResult {
  correct: boolean;
  actual: CaseId;
  guess: CaseId;
  ms: number;
}

export interface Session {
  n: number;
  ok: number;
  totalMs: number;
  streak: number;
}

export interface TrainerOptions {
  stats: StatsMap;
  enabled: Set<CaseId>;
  mode: Mode;
  /** Cases per session; null means endless. */
  target?: number | null;
  now?: () => number;
  random?: () => number;
}

const emptySession = (): Session => ({ n: 0, ok: 0, totalMs: 0, streak: 0 });

/**
 * The drill loop, with no DOM: start → show picture → answer → (wait after a miss) → next.
 * The UI calls markShown() once the picture has actually rendered, so load time isn't counted.
 */
export class Trainer {
  readonly stats: StatsMap;
  enabled: Set<CaseId>;
  mode: Mode;
  target: number | null;
  running = false;
  /** True after a wrong answer, until next() is called. */
  waiting = false;
  current: Picture | null = null;
  session: Session = emptySession();

  private shownAt: number | null = null;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(opts: TrainerOptions) {
    this.stats = opts.stats;
    this.enabled = opts.enabled;
    this.mode = opts.mode;
    this.target = opts.target ?? null;
    this.now = opts.now ?? (() => performance.now());
    this.random = opts.random ?? Math.random;
  }

  /** Begins a fresh session and returns the first picture. No-op if already running. */
  start(): Picture | null {
    if (this.running) return null;
    this.running = true;
    this.session = emptySession();
    return this.next();
  }

  stop(): void {
    this.running = false;
    this.waiting = false;
    this.current = null;
    this.shownAt = null;
  }

  /** True once the session has answered `target` cases. The UI then ends it instead of calling next(). */
  get complete(): boolean {
    return this.target != null && this.session.n >= this.target;
  }

  next(): Picture | null {
    if (!this.running || this.complete) return null;
    this.waiting = false;
    this.shownAt = null;
    const caseId = pickCase([...this.enabled], this.current?.caseId ?? null, this.mode, this.stats, this.random);
    const files = BY_ID[caseId].files;
    this.current = {
      caseId,
      file: files[Math.floor(this.random() * files.length)],
      color: COLORS[Math.floor(this.random() * COLORS.length)],
      angle: 1 + Math.floor(this.random() * ANGLES),
    };
    return this.current;
  }

  markShown(at: number = this.now()): void {
    this.shownAt = at;
  }

  /** Milliseconds since the current picture rendered, or 0 if it hasn't yet. */
  elapsed(): number {
    return this.shownAt == null ? 0 : this.now() - this.shownAt;
  }

  /** Returns null when an answer isn't expected (not running, waiting after a miss, picture not shown yet). */
  answer(guess: CaseId): AnswerResult | null {
    if (!this.running || this.waiting || !this.current || this.shownAt == null) return null;
    const ms = this.elapsed();
    const actual = this.current.caseId;
    const correct = guess === actual;
    recordAnswer(this.stats, actual, guess, ms);
    this.session.n++;
    if (correct) {
      this.session.ok++;
      this.session.totalMs += ms;
      this.session.streak++;
    } else {
      this.session.streak = 0;
      this.waiting = true;
    }
    return { correct, actual, guess, ms };
  }

  /** Toggles a case in the drill. Refuses to remove the last one. Returns true if the set changed. */
  toggleCase(id: CaseId): boolean {
    if (this.enabled.has(id)) {
      if (this.enabled.size <= 1) return false;
      this.enabled.delete(id);
    } else {
      this.enabled.add(id);
    }
    return true;
  }
}
