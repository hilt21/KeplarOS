/**
 * Vitest global setup.
 *
 * jsdom's localStorage is unavailable for opaque origins. Stub a
 * minimal localStorage shim before any test file loads so modules
 * that read localStorage at import time (e.g. theme bootstrap) do
 * not crash.
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (
  typeof window !== "undefined" &&
  window.localStorage &&
  typeof window.localStorage.setItem !== "function"
) {
  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}
