import {
  addFavorite,
  readFavorites,
  removeFavorite,
  clearFavorites,
  isFavorited,
} from "@/lib/favorites";

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

describe("favorites", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    uninstallLocalStorage();
  });

  test("addFavorite then readFavorites returns the entry", () => {
    addFavorite({
      query: "De Pijp",
      label: "De Pijp, Amsterdam",
      kind: "buurt",
      city: "Amsterdam",
      addedAt: 1000,
    });

    const entries = readFavorites();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe("De Pijp");
    expect(entries[0].city).toBe("Amsterdam");
  });

  test("readFavorites returns [] when nothing has been written", () => {
    expect(readFavorites()).toEqual([]);
  });

  test("addFavorite is a no-op when the normalized query already exists", () => {
    addFavorite({ query: "De Pijp", label: "L1", kind: "buurt", city: "Amsterdam", addedAt: 1000 });
    addFavorite({ query: "Centrum", label: "L2", kind: "wijk", city: "Amsterdam", addedAt: 2000 });
    addFavorite({ query: "  de pijp  ", label: "L1-NEW", kind: "buurt", city: "Amsterdam", addedAt: 3000 });

    const entries = readFavorites();
    expect(entries).toHaveLength(2);
    const dePijp = entries.find((e) => e.query === "De Pijp");
    expect(dePijp?.label).toBe("L1");
    expect(dePijp?.addedAt).toBe(1000);
    expect(entries.map((e) => e.query)).toEqual(["De Pijp", "Centrum"]);
  });

  test("addFavorite caps at 50, dropping the entry with the smallest addedAt", () => {
    for (let i = 1; i <= 50; i++) {
      addFavorite({ query: `q${i}`, label: `L${i}`, kind: "postcode", city: "City", addedAt: i });
    }
    addFavorite({ query: "q51", label: "L51", kind: "postcode", city: "City", addedAt: 51 });

    const entries = readFavorites();
    expect(entries).toHaveLength(50);
    expect(entries.find((e) => e.query === "q1")).toBeUndefined();
    expect(entries.find((e) => e.query === "q51")?.addedAt).toBe(51);
  });

  test("removeFavorite removes by normalized query", () => {
    addFavorite({ query: "De Pijp", label: "L1", kind: "buurt", city: "Amsterdam", addedAt: 1 });
    addFavorite({ query: "Centrum", label: "L2", kind: "wijk", city: "Amsterdam", addedAt: 2 });

    removeFavorite("DE PIJP");

    const entries = readFavorites();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe("Centrum");
  });

  test("clearFavorites empties the list", () => {
    addFavorite({ query: "De Pijp", label: "L1", kind: "buurt", city: "Amsterdam", addedAt: 1 });
    clearFavorites();
    expect(readFavorites()).toEqual([]);
  });

  test("isFavorited matches on normalized query", () => {
    addFavorite({ query: "De Pijp", label: "L1", kind: "buurt", city: "Amsterdam", addedAt: 1 });
    expect(isFavorited("De Pijp")).toBe(true);
    expect(isFavorited("DE PIJP")).toBe(true);
    expect(isFavorited("  de pijp  ")).toBe(true);
    expect(isFavorited("Centrum")).toBe(false);
  });

  test("readFavorites drops malformed entries without throwing", () => {
    localStorage.setItem(
      "buurtje:favorites",
      JSON.stringify([
        { query: "good", label: "Good", kind: "buurt", city: "City", addedAt: 1 },
        { query: "missing-fields" },
        { query: 123, label: "wrong type", kind: "buurt", city: "City", addedAt: 2 },
        { query: "no-city", label: "No City", kind: "buurt", addedAt: 3 },
        "not even an object",
      ])
    );
    const entries = readFavorites();
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe("good");
  });

  test("APIs degrade silently when localStorage is unavailable", () => {
    uninstallLocalStorage();
    expect(() =>
      addFavorite({ query: "De Pijp", label: "L", kind: "buurt", city: "Amsterdam", addedAt: 1 })
    ).not.toThrow();
    expect(() => removeFavorite("De Pijp")).not.toThrow();
    expect(() => clearFavorites()).not.toThrow();
    expect(readFavorites()).toEqual([]);
    expect(isFavorited("De Pijp")).toBe(false);
    installLocalStorage();
  });
});
