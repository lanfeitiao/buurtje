import { addToHistory, readHistory, removeFromHistory, clearHistory } from "@/lib/history";

function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

function uninstallLocalStorage() {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
}

describe("history", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    uninstallLocalStorage();
  });

  test("addToHistory then readHistory returns the entry", () => {
    addToHistory({
      query: "Amsterdam",
      label: "Amsterdam Centrum, Amsterdam",
      kind: "buurt",
      timestamp: 1000,
    });

    const entries = readHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe("Amsterdam");
    expect(entries[0].kind).toBe("buurt");
  });

  test("readHistory returns [] when nothing has been written", () => {
    expect(readHistory()).toEqual([]);
  });

  test("addToHistory dedupes by normalized query and refreshes timestamp", () => {
    addToHistory({ query: "Amsterdam", label: "Amsterdam (old)", kind: "buurt", timestamp: 1000 });
    addToHistory({ query: "  amsterdam  ", label: "Amsterdam (new)", kind: "buurt", timestamp: 2000 });

    const entries = readHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("Amsterdam (new)");
    expect(entries[0].timestamp).toBe(2000);
  });
});
