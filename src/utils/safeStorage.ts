/**
 * =============================================================================
 * File: src/utils/safeStorage.ts
 * Purpose: Safe wrapper for LocalStorage and SessionStorage.
 *
 * Catches SecurityError exceptions thrown when storage is blocked by tracking
 * prevention features or strict privacy modes. Automatically falls back
 * to a lightweight in-memory storage implementation, and polyfills window.localStorage
 * and window.sessionStorage globally to prevent third-party library crashes.
 * =============================================================================
 */

class InMemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

// Global detection and polyfill execution
const testAndPolyfill = () => {
  // Polyfill localStorage if blocked
  try {
    const storage = window.localStorage;
    const testKey = "__udg_storage_test_localStorage__";
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
  } catch (e) {
    console.warn("[SafeStorage] localStorage blocked (Tracking Prevention). Polyfilling globally...", e);
    try {
      Object.defineProperty(window, 'localStorage', {
        value: new InMemoryStorage(),
        writable: false,
        configurable: true
      });
    } catch (err) {
      console.error("[SafeStorage] Failed to redefine window.localStorage:", err);
    }
  }

  // Polyfill sessionStorage if blocked
  try {
    const storage = window.sessionStorage;
    const testKey = "__udg_storage_test_sessionStorage__";
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
  } catch (e) {
    console.warn("[SafeStorage] sessionStorage blocked (Tracking Prevention). Polyfilling globally...", e);
    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: new InMemoryStorage(),
        writable: false,
        configurable: true
      });
    } catch (err) {
      console.error("[SafeStorage] Failed to redefine window.sessionStorage:", err);
    }
  }
};

// Run polyfill immediately upon file load
testAndPolyfill();

// Export safe references (pointing to either the native or polyfilled instances)
export const safeLocalStorage = window.localStorage;
export const safeSessionStorage = window.sessionStorage;
