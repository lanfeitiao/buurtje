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

  test("addToHistory caps at 50 entries, dropping the oldest by timestamp", () => {
    // pre-fill 50 entries with timestamps 1..50; query 1 is oldest
    for (let i = 1; i <= 50; i++) {
      addToHistory({ query: `q${i}`, label: `L${i}`, kind: "postcode", timestamp: i });
    }

    addToHistory({ query: "q51", label: "L51", kind: "postcode", timestamp: 51 });

    const entries = readHistory();
    expect(entries).toHaveLength(50);
    // The entry with timestamp 1 should have been evicted
    expect(entries.find((e) => e.timestamp === 1)).toBeUndefined();
    // The new entry should be present
    expect(entries.find((e) => e.query === "q51")?.timestamp).toBe(51);
  });

  test("removeFromHistory removes the matching entry by normalized query", () => {
    addToHistory({ query: "Amsterdam", label: "L1", kind: "buurt", timestamp: 1 });
    addToHistory({ query: "Rotterdam", label: "L2", kind: "buurt", timestamp: 2 });

    removeFromHistory("AMSTERDAM");

    const entries = readHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe("Rotterdam");
  });

  test("clearHistory empties the list", () => {
    addToHistory({ query: "Amsterdam", label: "L1", kind: "buurt", timestamp: 1 });
    addToHistory({ query: "Rotterdam", label: "L2", kind: "buurt", timestamp: 2 });

    clearHistory();

    expect(readHistory()).toEqual([]);
  });

  test("readHistory drops malformed entries without throwing", () => {
    // Hand-write a corrupt blob: one valid entry, one missing fields, one wrong type
    localStorage.setItem(
      "buurtje:search-history",
      JSON.stringify([
        { query: "good", label: "Good", kind: "buurt", timestamp: 1 },
        { query: "missing-fields" },
        { query: 123, label: "wrong type", kind: "buurt", timestamp: 2 },
        "not even an object",
      ])
    );

    const entries = readHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe("good");
  });

  test("APIs degrade silently when localStorage is unavailable", () => {
    uninstallLocalStorage();

    expect(() =>
      addToHistory({ query: "Amsterdam", label: "L", kind: "buurt", timestamp: 1 })
    ).not.toThrow();
    expect(() => removeFromHistory("Amsterdam")).not.toThrow();
    expect(() => clearHistory()).not.toThrow();
    expect(readHistory()).toEqual([]);

    // restore for any later tests in this file
    installLocalStorage();
  });

  test("addToHistory round-trips the optional city field", () => {
    addToHistory({
      query: "De Pijp",
      label: "De Pijp, Amsterdam",
      kind: "buurt",
      timestamp: 1000,
      city: "Amsterdam",
    });
    const entries = readHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].city).toBe("Amsterdam");
  });

  test("addToHistory accepts entries without a city (legacy)", () => {
    addToHistory({
      query: "De Pijp",
      label: "De Pijp, Amsterdam",
      kind: "buurt",
      timestamp: 1000,
    });
    const entries = readHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].city).toBeUndefined();
  });
});
