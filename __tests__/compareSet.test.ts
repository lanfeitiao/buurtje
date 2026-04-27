import {
  addToCompareSet,
  readCompareSet,
  removeFromCompareSet,
  clearCompareSet,
  isInCompareSet,
} from "@/lib/compareSet";

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

describe("compareSet", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    uninstallLocalStorage();
  });

  test("addToCompareSet then readCompareSet returns the entry", () => {
    addToCompareSet({
      query: "De Pijp",
      label: "De Pijp, Amsterdam",
      kind: "buurt",
      addedAt: 1000,
    });

    const entries = readCompareSet();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe("De Pijp");
    expect(entries[0].kind).toBe("buurt");
  });

  test("readCompareSet returns [] when nothing has been written", () => {
    expect(readCompareSet()).toEqual([]);
  });

  test("addToCompareSet is a no-op when the normalized query already exists", () => {
    addToCompareSet({ query: "De Pijp", label: "L1", kind: "buurt", addedAt: 1000 });
    addToCompareSet({ query: "Centrum", label: "L2", kind: "buurt", addedAt: 2000 });
    addToCompareSet({ query: "  de pijp  ", label: "L1-NEW", kind: "buurt", addedAt: 3000 });

    const entries = readCompareSet();
    expect(entries).toHaveLength(2);
    // Original De Pijp entry should be unchanged: same label, same addedAt
    const dePijp = entries.find((e) => e.query === "De Pijp");
    expect(dePijp?.label).toBe("L1");
    expect(dePijp?.addedAt).toBe(1000);
    // Insertion order preserved: De Pijp first, Centrum second
    expect(entries.map((e) => e.query)).toEqual(["De Pijp", "Centrum"]);
  });

  test("addToCompareSet caps at 4 entries, dropping the oldest by addedAt", () => {
    addToCompareSet({ query: "q1", label: "L1", kind: "postcode", addedAt: 1 });
    addToCompareSet({ query: "q2", label: "L2", kind: "postcode", addedAt: 2 });
    addToCompareSet({ query: "q3", label: "L3", kind: "postcode", addedAt: 3 });
    addToCompareSet({ query: "q4", label: "L4", kind: "postcode", addedAt: 4 });
    addToCompareSet({ query: "q5", label: "L5", kind: "postcode", addedAt: 5 });

    const entries = readCompareSet();
    expect(entries).toHaveLength(4);
    expect(entries.find((e) => e.query === "q1")).toBeUndefined();
    expect(entries.find((e) => e.query === "q5")?.addedAt).toBe(5);
    expect(entries.map((e) => e.query)).toEqual(["q2", "q3", "q4", "q5"]);
  });

  test("removeFromCompareSet removes the matching entry by normalized query", () => {
    addToCompareSet({ query: "De Pijp", label: "L1", kind: "buurt", addedAt: 1 });
    addToCompareSet({ query: "Centrum", label: "L2", kind: "buurt", addedAt: 2 });

    removeFromCompareSet("DE PIJP");

    const entries = readCompareSet();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe("Centrum");
  });

  test("clearCompareSet empties the list", () => {
    addToCompareSet({ query: "De Pijp", label: "L1", kind: "buurt", addedAt: 1 });
    addToCompareSet({ query: "Centrum", label: "L2", kind: "buurt", addedAt: 2 });
    clearCompareSet();
    expect(readCompareSet()).toEqual([]);
  });
});
