const PREFIX = "pllrt:";

/**
 * localStorage wrapper that never throws. Private windows and blocked site data
 * make the accessor throw; the trainer should still work, it just won't remember.
 */
export function createStore(backend: Pick<Storage, "getItem" | "setItem"> | null = safeLocalStorage()) {
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = backend?.getItem(PREFIX + key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown): void {
      try {
        backend?.setItem(PREFIX + key, JSON.stringify(value));
      } catch {
        /* storage full or blocked: ignore */
      }
    },
  };
}

export type Store = ReturnType<typeof createStore>;

function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
