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
});
