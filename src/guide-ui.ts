import { imageUrl } from "./cases";
import { ANGLES, PLL_ALGS, SIDE_COLORS, topRingFor, viewOf } from "./cube.ts";
import { CREDIT, GUIDE, HOW_TO, TERMS, recognize } from "./guide.ts";

/** One real cube picture per rule: the first picture that rule decides. */
function examples(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [variant, alg] of Object.entries(PLL_ALGS)) {
    const ring = topRingFor(alg);
    for (const color of SIDE_COLORS)
      for (const angle of ANGLES) {
        const rule = recognize(viewOf(ring, color, angle));
        if (rule && !out.has(rule.id)) out.set(rule.id, imageUrl(variant, color, angle));
      }
  }
  return out;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A row of 6 stickers as drawn in the guide: left side, then right side; "." is "doesn't matter". */
function strip(code: string): string {
  const cell = (ch: string) => `<i class="s s-${ch === "." ? "x" : ch}"></i>`;
  return `<span class="strip" aria-hidden="true">${[...code.slice(0, 3)].map(cell).join("")}<b></b>${[...code.slice(3)].map(cell).join("")}</span>`;
}

/** Fills the guide popover. Called once, the first time it opens. */
export function renderGuide(body: HTMLElement): void {
  const pics = examples();
  const howTo = HOW_TO.map((t) => `<li>${escape(t)}</li>`).join("");
  const terms = TERMS.map(([t, d]) => `<li><b>${escape(t)}</b> ${escape(d)}</li>`).join("");
  const cards = GUIDE.map(
    (p, i) => `
      <section class="guide-card">
        <h3><span class="guide-num">${i + 1}</span><span class="guide-title">${escape(p.title)}</span>${strip(p.strip)}</h3>
        <ul class="guide-rules">
          ${p.rules
            .map(
              (r) => `
            <li>
              ${strip(r.strip)}
              <span class="guide-when">${escape(r.when)}</span>
              <b class="guide-answer">${escape(r.label)}</b>
              <img src="${pics.get(r.id)}" alt="Example: ${r.then} perm" width="44" height="44" loading="lazy">
            </li>`,
            )
            .join("")}
        </ul>
      </section>`,
  ).join("");

  body.innerHTML = `
    <p class="guide-credit">From <a href="${CREDIT.url}" target="_blank" rel="noopener">${escape(CREDIT.text)}</a> (v2014.05.31).</p>
    <ul class="guide-howto">${howTo}</ul>
    <ul class="guide-terms">${terms}</ul>
    <div class="guide-cards">${cards}</div>
    <p class="guide-foot">Strips show the 6 stickers you see, left side then right side; grey means it doesn't matter. The cube on each row is a real example of that rule.</p>`;
}
