import { CASES, GROUP_LABELS, type CaseId } from "./cases";
import { buildRows, sortRows, type SortKey, type StatsMap, type Tag } from "./stats";
import type { Session } from "./trainer";

/** Rendering only. No trainer state lives here. */

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

const keyEl = (id: CaseId) => $(`key-${id}`);

export function buildPad(onPress: (id: CaseId) => void): void {
  const pad = $("pad");
  pad.replaceChildren();
  for (const label of GROUP_LABELS) {
    const group = document.createElement("div");
    group.className = "group";
    const heading = document.createElement("div");
    heading.className = "group-label";
    heading.textContent = label;
    const keys = document.createElement("div");
    keys.className = "keys";
    for (const c of CASES.filter((c) => c.group === label)) {
      const b = document.createElement("button");
      b.className = "key";
      b.id = `key-${c.id}`;
      b.innerHTML = `${c.id}<small>${c.alias}</small>`;
      b.addEventListener("click", () => onPress(c.id));
      keys.append(b);
    }
    group.append(heading, keys);
    pad.append(group);
  }
}

export function renderEnabled(enabled: Set<CaseId>): void {
  for (const c of CASES) keyEl(c.id).classList.toggle("off", !enabled.has(c.id));
  $("selectNote").textContent = `${enabled.size} of ${CASES.length} cases in the drill`;
}

export function clearMarks(): void {
  document.querySelectorAll(".key.right, .key.wrong").forEach((k) => k.classList.remove("right", "wrong"));
  $("cube").classList.remove("good", "bad");
  setFeedback("", null);
}

export function markResult(correct: boolean, actual: CaseId, guess: CaseId): void {
  $("cube").classList.add(correct ? "good" : "bad");
  keyEl(actual).classList.add("right");
  if (correct) {
    setFeedback(`${actual} ✓`, "good");
  } else {
    keyEl(guess).classList.add("wrong");
    setFeedback(`It's ${actual}, not ${guess}. Space or click the cube for next.`, "bad");
  }
}

export function setFeedback(text: string, kind: "good" | "bad" | null): void {
  const el = $("feedback");
  el.textContent = text;
  el.className = kind ? `feedback ${kind}` : "feedback";
}

export function setIdle(idle: boolean): void {
  $("cube").classList.toggle("idle", idle);
  $("stopBtn").hidden = idle;
}

export function renderTarget(target: number | null, locked: boolean): void {
  $("targetSeg")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.target) === (target ?? 0)));
      b.disabled = locked;
    });
}

export function summary(s: Session): string {
  const acc = s.n ? Math.round((100 * s.ok) / s.n) : 0;
  const avg = s.ok ? ` · avg ${(s.totalMs / s.ok / 1000).toFixed(2)}s` : "";
  return `Done: ${s.n} cases · ${acc}% correct${avg}. Press Space to go again.`;
}

export function setTimer(ms: number): void {
  $("timer").textContent = (ms / 1000).toFixed(2);
}

export function setTyped(buffer: string): void {
  $("typed").textContent = buffer ? `→ ${buffer}` : "";
}

export function setPressed(id: string, pressed: boolean): void {
  $(id).setAttribute("aria-pressed", String(pressed));
}

export function renderSession(s: Session, target: number | null): void {
  $("sCount").textContent = target ? `${s.n} / ${target}` : String(s.n);
  $("sAcc").textContent = s.n ? `${Math.round((100 * s.ok) / s.n)}%` : "–";
  $("sAvg").textContent = s.ok ? `${(s.totalMs / s.ok / 1000).toFixed(2)}s` : "–";
  $("sStreak").textContent = String(s.streak);
}

const TAG_LABEL: Record<Exclude<Tag, null>, string> = { new: "new", misses: "misses", slow: "slow" };

export function renderStats(stats: StatsMap, sortKey: SortKey, onSort: (key: SortKey) => void): void {
  const rows = sortRows(buildRows(stats, CASES), sortKey, CASES.map((c) => c.id));
  const maxAvg = Math.max(1, ...rows.map((r) => r.avgMs ?? 0));

  const th = (key: SortKey, label: string, cls = "") =>
    `<th class="${cls}" data-sort="${key}">${label}${sortKey === key ? " ▾" : ""}</th>`;
  const head =
    `<thead><tr>${th("name", "Case")}${th("avg", "Avg time (last 20)", "num")}<th></th>` +
    `${th("acc", "Correct", "num")}${th("n", "Seen", "num")}<th>Mixed up with</th><th></th></tr></thead>`;

  const body = rows
    .map((r) => {
      const avg = r.avgMs != null ? `${(r.avgMs / 1000).toFixed(2)}s` : "–";
      const bar = r.avgMs != null ? `<span class="bar" style="width:${Math.round((80 * r.avgMs) / maxAvg)}px"></span>` : "";
      const acc = r.accuracy != null ? `${Math.round(r.accuracy * 100)}%` : "–";
      const confused = r.topConfusion ? `${r.topConfusion.id} ×${r.topConfusion.count}` : "";
      const tag = r.tag ? `<span class="pill ${r.tag}">${TAG_LABEL[r.tag]}</span>` : "";
      return `<tr><td class="name">${r.id}</td><td class="num">${avg}</td><td>${bar}</td><td class="num">${acc}</td><td class="num">${r.n}</td><td>${confused}</td><td>${tag}</td></tr>`;
    })
    .join("");

  const table = $("stats");
  table.innerHTML = `${head}<tbody>${body}</tbody>`;
  table.querySelectorAll<HTMLElement>("th[data-sort]").forEach((h) =>
    h.addEventListener("click", () => onSort(h.dataset.sort as SortKey)),
  );
}
