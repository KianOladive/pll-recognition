import "./style.css";
import { ANGLES, CASES, COLORS, DEFAULT_ENABLED, imageUrl, type CaseId } from "./cases";
import { renderGuide } from "./guide-ui";
import { AliasMatcher } from "./input";
import type { Mode, SortKey, StatsMap } from "./stats";
import { createStore } from "./storage";
import { Trainer, type Picture } from "./trainer";
import * as ui from "./ui";

const NEXT_DELAY_MS = 350;
const RESET_CONFIRM_MS = 3000;

const store = createStore();
const trainer = new Trainer({
  stats: store.get<StatsMap>("stats", {}),
  enabled: new Set(store.get<CaseId[]>("enabled", DEFAULT_ENABLED).filter((id) => CASES.some((c) => c.id === id))),
  mode: store.get<Mode>("mode", "random"),
  target: store.get<number | null>("target", 25),
});
if (trainer.enabled.size === 0) DEFAULT_ENABLED.forEach((id) => trainer.enabled.add(id));

const matcher = new AliasMatcher(Object.fromEntries(CASES.map((c) => [c.alias, c.id])));
let sortKey = store.get<SortKey>("sort", "avg");
let clickMode: "answer" | "toggle" = "answer";
let nextTimer = 0;
let rafId = 0;

// Preload every picture (336 small SVGs, about 1.4 MB) so recognition time isn't download time.
for (const c of CASES)
  for (const f of c.files)
    for (const color of COLORS) for (let a = 1; a <= ANGLES; a++) new Image().src = imageUrl(f, color, a);

function show(pic: Picture | null): void {
  if (!pic) return;
  clearTimeout(nextTimer);
  matcher.reset();
  ui.setTyped("");
  ui.clearMarks();
  const img = ui.$<HTMLImageElement>("cubeImg");
  const onShown = () => {
    trainer.markShown();
    runTimer();
  };
  img.onload = onShown;
  img.src = imageUrl(pic.file, pic.color, pic.angle);
  if (img.complete) onShown();
}

function runTimer(): void {
  cancelAnimationFrame(rafId);
  const loop = () => {
    if (!trainer.running || trainer.waiting) return;
    ui.setTimer(trainer.elapsed());
    rafId = requestAnimationFrame(loop);
  };
  loop();
}

function start(): void {
  const pic = trainer.start();
  if (!pic) return;
  ui.setIdle(false);
  ui.renderTarget(trainer.target, true);
  ui.renderSession(trainer.session, trainer.target);
  show(pic);
}

/** Next case, or the end-of-session summary once the chosen number of cases is done. */
function advance(): void {
  if (trainer.complete) stop(ui.summary(trainer.session));
  else show(trainer.next());
}

function stop(message?: string): void {
  const answered = trainer.session.n;
  trainer.stop();
  clearTimeout(nextTimer);
  cancelAnimationFrame(rafId);
  matcher.reset();
  ui.setTyped("");
  ui.clearMarks();
  ui.setIdle(true);
  ui.setTimer(0);
  ui.renderTarget(trainer.target, false);
  if (message) ui.setFeedback(message, "good");
  else if (answered) ui.setFeedback(`Stopped after ${answered} cases.`, null);
  ui.$("startBtn").focus();
}

function answer(guess: CaseId): void {
  const result = trainer.answer(guess);
  if (!result) return;
  cancelAnimationFrame(rafId);
  ui.setTimer(result.ms);
  ui.markResult(result.correct, result.actual, result.guess);
  ui.renderSession(trainer.session, trainer.target);
  store.set("stats", trainer.stats);
  renderStats();
  if (result.correct) nextTimer = window.setTimeout(advance, NEXT_DELAY_MS);
}

function setTarget(target: number | null): void {
  if (trainer.running) return;
  trainer.target = target;
  store.set("target", target);
  ui.renderTarget(target, false);
  ui.renderSession(trainer.session, target);
}

function toggleCase(id: CaseId): void {
  if (!trainer.toggleCase(id)) return;
  store.set("enabled", [...trainer.enabled]);
  ui.renderEnabled(trainer.enabled);
  if (trainer.running && trainer.current && !trainer.enabled.has(trainer.current.caseId)) show(trainer.next());
}

function setMode(mode: Mode): void {
  trainer.mode = mode;
  store.set("mode", mode);
  ui.setPressed("modeRandom", mode === "random");
  ui.setPressed("modeWeak", mode === "weak");
}

function setClickMode(mode: typeof clickMode): void {
  clickMode = mode;
  ui.setPressed("clickAnswer", mode === "answer");
  ui.setPressed("clickToggle", mode === "toggle");
}

function renderStats(): void {
  ui.renderStats(trainer.stats, sortKey, (key) => {
    sortKey = key;
    store.set("sort", key);
    renderStats();
  });
}

let resetArmed = false;
let resetTimer = 0;
function resetStats(): void {
  const btn = ui.$("reset");
  if (!resetArmed) {
    resetArmed = true;
    btn.classList.add("armed");
    btn.textContent = "Click again to wipe";
    resetTimer = window.setTimeout(disarm, RESET_CONFIRM_MS);
    return;
  }
  for (const id of Object.keys(trainer.stats)) delete trainer.stats[id];
  store.set("stats", trainer.stats);
  trainer.session = { n: 0, ok: 0, totalMs: 0, streak: 0 };
  disarm();
  ui.renderSession(trainer.session, trainer.target);
  renderStats();

  function disarm() {
    clearTimeout(resetTimer);
    resetArmed = false;
    btn.classList.remove("armed");
    btn.textContent = "Reset stats";
  }
}

const guide = ui.$("guide");
const guideOpen = () => guide.matches(":popover-open");

function onKey(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (guideOpen()) return; // the popover handles its own keys (Esc closes it)
  const isGo = e.key === " " || e.key === "Enter";
  // Space/Enter would also "click" whichever button has focus; drop focus so only this handler acts.
  if (isGo) {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
  if (!trainer.running) {
    if (isGo) start();
    return;
  }
  if (e.key === "Escape") return stop();
  if (isGo) {
    if (trainer.waiting) advance();
    return;
  }
  if (e.key === "Backspace") {
    matcher.reset();
    ui.setTyped("");
    return;
  }
  if (!/^[a-z]$/i.test(e.key) || trainer.waiting) return;
  const match = matcher.push(e.key);
  ui.setTyped(matcher.typed);
  if (match) answer(match);
}

// Wire up
ui.buildPad((id) => (clickMode === "answer" ? answer(id) : toggleCase(id)));
ui.$("startBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  start();
});
ui.$("stopBtn").addEventListener("click", () => stop());
ui.$("cube").addEventListener("click", () => {
  if (trainer.running && trainer.waiting) advance();
});
ui.$("targetSeg")
  .querySelectorAll<HTMLButtonElement>("button")
  .forEach((b) => b.addEventListener("click", () => setTarget(Number(b.dataset.target) || null)));
ui.$("modeRandom").addEventListener("click", () => setMode("random"));
ui.$("modeWeak").addEventListener("click", () => setMode("weak"));
ui.$("clickAnswer").addEventListener("click", () => setClickMode("answer"));
ui.$("clickToggle").addEventListener("click", () => setClickMode("toggle"));
ui.$("reset").addEventListener("click", resetStats);
document.addEventListener("keydown", onKey);

// Reading the guide mid-drill would count against your times, so opening it ends the session.
let guideRendered = false;
guide.addEventListener("toggle", (e) => {
  if ((e as ToggleEvent).newState !== "open") return;
  if (trainer.running) stop();
  if (!guideRendered) {
    renderGuide(ui.$("guideBody"));
    guideRendered = true;
  }
});

setMode(trainer.mode);
ui.renderEnabled(trainer.enabled);
ui.renderTarget(trainer.target, false);
ui.renderSession(trainer.session, trainer.target);
renderStats();
