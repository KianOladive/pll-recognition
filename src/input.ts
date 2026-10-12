import type { CaseId } from "./cases";

/**
 * Turns keystrokes into answers. Letters build up a buffer; as soon as the buffer
 * exactly matches one alias (and no longer alias starts with it), that case is the answer.
 */
export class AliasMatcher {
  private buffer = "";
  private readonly byAlias: Map<string, CaseId>;

  constructor(aliases: Record<string, CaseId>) {
    this.byAlias = new Map(Object.entries(aliases).map(([a, id]) => [a.toLowerCase(), id]));
  }

  get typed(): string {
    return this.buffer;
  }

  reset(): void {
    this.buffer = "";
  }

  /** Feed one letter. Returns the matched case, or null if more input is needed. */
  push(letter: string): CaseId | null {
    const ch = letter.toLowerCase();
    this.buffer += ch;
    // A dead-end buffer restarts from the new letter, so a typo doesn't block the next attempt.
    if (!this.hasPrefix(this.buffer)) this.buffer = ch;
    if (!this.hasPrefix(this.buffer)) this.buffer = "";

    const match = this.byAlias.get(this.buffer);
    if (match !== undefined && !this.hasLongerAlias(this.buffer)) {
      this.buffer = "";
      return match;
    }
    return null;
  }

  private hasPrefix(p: string): boolean {
    if (!p) return false;
    for (const a of this.byAlias.keys()) if (a.startsWith(p)) return true;
    return false;
  }

  private hasLongerAlias(p: string): boolean {
    for (const a of this.byAlias.keys()) if (a !== p && a.startsWith(p)) return true;
    return false;
  }
}
