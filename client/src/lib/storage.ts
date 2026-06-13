// localStorage with an in-memory fallback (test environments, private browsing).
function createStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.getItem('__probe__');
      return localStorage;
    }
  } catch {
    // fall through to memory storage
  }
  const mem = new Map<string, string>();
  return {
    getItem: (key) => mem.get(key) ?? null,
    setItem: (key, value) => void mem.set(key, value),
    removeItem: (key) => void mem.delete(key),
  };
}

export const storage = createStorage();
