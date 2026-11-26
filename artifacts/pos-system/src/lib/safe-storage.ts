const memorySession = new Map<string, string>();
const memoryLocal = new Map<string, string>();

function makeMemoryStorage(backing: Map<string, string>): Storage {
  return {
    get length() {
      return backing.size;
    },
    clear() {
      backing.clear();
    },
    getItem(key: string) {
      return backing.has(key) ? backing.get(key)! : null;
    },
    key(index: number) {
      return Array.from(backing.keys())[index] ?? null;
    },
    removeItem(key: string) {
      backing.delete(key);
    },
    setItem(key: string, value: string) {
      backing.set(key, String(value));
    },
  };
}

let shimmed = false;

export function installSafeWebStorageShim(): void {
  if (shimmed || typeof window === "undefined") return;
  shimmed = true;

  const ensureStorage = (prop: "localStorage" | "sessionStorage", backing: Map<string, string>) => {
    try {
      const store = window[prop];
      const probeKey = "__omni_probe__";
      store.setItem(probeKey, "1");
      store.removeItem(probeKey);
    } catch {
      try {
        const mem = makeMemoryStorage(backing);
        Object.defineProperty(window, prop, {
          configurable: true,
          enumerable: true,
          get: () => mem,
        });
      } catch {}
    }
  };

  ensureStorage("sessionStorage", memorySession);
  ensureStorage("localStorage", memoryLocal);
}

export function safeGetSessionItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(key);
    }
  } catch {}
  return memorySession.get(key) ?? null;
}

export function safeSetSessionItem(key: string, value: string): void {
  memorySession.set(key, String(value));
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(key, String(value));
    }
  } catch {}
}

export function safeRemoveSessionItem(key: string): void {
  memorySession.delete(key);
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch {}
}

export function safeGetLocalItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {}
  return memoryLocal.get(key) ?? null;
}

export function safeSetLocalItem(key: string, value: string): void {
  memoryLocal.set(key, String(value));
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, String(value));
    }
  } catch {}
}

export function safeRemoveLocalItem(key: string): void {
  memoryLocal.delete(key);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

export function getStoredAuthToken(): string | null {
  return safeGetSessionItem("pos_token") || safeGetLocalItem("pos_token");
}

export function setStoredAuthToken(token: string): void {
  safeSetSessionItem("pos_token", token);
  safeSetLocalItem("pos_token", token);
}

export function clearStoredAuthToken(): void {
  safeRemoveSessionItem("pos_token");
  safeRemoveLocalItem("pos_token");
  safeRemoveLocalItem("token");
}
