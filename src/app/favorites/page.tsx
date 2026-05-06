"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFavorites } from "@/lib/useFavorites";
import { useCompareSet } from "@/lib/useCompareSet";
import CityTabs from "@/components/CityTabs";
import FavoritesList from "@/components/FavoritesList";
import CompareSetChip from "@/components/CompareSetChip";
import { normalizeQuery } from "@/lib/queryNormalize";
import type { FavoriteEntry } from "@/lib/types";

const MAX_ENTRIES = 50;
const COMPARE_CAP = 4;
const OTHER_CITY = "Other";

function groupByCity(entries: FavoriteEntry[]): Map<string, FavoriteEntry[]> {
  const map = new Map<string, FavoriteEntry[]>();
  for (const e of entries) {
    const key = e.city.trim() === "" ? OTHER_CITY : e.city;
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return map;
}

function sortedCityNames(map: Map<string, FavoriteEntry[]>): string[] {
  // Alphabetical, "Other" pinned last.
  const names = Array.from(map.keys());
  names.sort((a, b) => {
    if (a === OTHER_CITY) return 1;
    if (b === OTHER_CITY) return -1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return names;
}

export default function FavoritesPage() {
  const router = useRouter();
  const { entries, remove } = useFavorites();
  const { add: addCompare } = useCompareSet();

  const groups = useMemo(() => groupByCity(entries), [entries]);
  const cityNames = useMemo(() => sortedCityNames(groups), [groups]);

  const [activeCity, setActiveCity] = useState<string>("");
  const [mode, setMode] = useState<"navigate" | "select">("navigate");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pick / re-pick the active tab when the data changes.
  useEffect(() => {
    if (cityNames.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (activeCity !== "") setActiveCity("");
      return;
    }
    if (!cityNames.includes(activeCity)) {
      setActiveCity(cityNames[0]);
    }
  }, [cityNames, activeCity]);

  const tabsForStrip = cityNames.map((name) => ({
    name,
    count: groups.get(name)?.length ?? 0,
  }));
  const visibleEntries = activeCity ? groups.get(activeCity) ?? [] : [];

  function handleSelect(query: string) {
    router.push(`/?q=${encodeURIComponent(query)}`);
  }

  function handleToggleMode() {
    if (mode === "select") {
      setMode("navigate");
      setSelected(new Set());
    } else {
      setMode("select");
    }
  }

  function handleToggleEntry(query: string) {
    const norm = normalizeQuery(query);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) {
        next.delete(norm);
      } else if (next.size < COMPARE_CAP) {
        next.add(norm);
      }
      return next;
    });
  }

  function handleCompareSelected() {
    const chosen = entries.filter((e) => selected.has(normalizeQuery(e.query)));
    if (chosen.length < 1) return;
    chosen.forEach((entry, i) => {
      addCompare({
        query: entry.query,
        label: entry.label,
        kind: entry.kind,
        addedAt: Date.now() + i,
      });
    });
    router.push("/compare");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: "#E65100" }}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Buurtje
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              className="text-sm font-semibold"
              style={{ color: "#E65100" }}
            >
              History
            </Link>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back
            </Link>
            <CompareSetChip />
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleToggleMode}
                className={`rounded-md border px-2.5 py-1 text-xs font-bold ${
                  mode === "select" ? "bg-orange-50" : "bg-white"
                }`}
                style={{ color: "#E65100", borderColor: "#E65100" }}
              >
                {mode === "select" ? "Cancel" : "Compare"}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between px-5 pb-1 pt-5">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Favorites</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {entries.length} of {MAX_ENTRIES} saved
              {mode === "select" && selected.size > 0 && (
                <span className="ml-2 text-orange-600">
                  · {selected.size} of {COMPARE_CAP} selected
                </span>
              )}
            </p>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">No favorites yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Tap the heart on a search result to start saving.
            </p>
          </div>
        ) : (
          <>
            <CityTabs
              cities={tabsForStrip}
              activeCity={activeCity}
              onChange={setActiveCity}
            />
            <FavoritesList
              entries={visibleEntries}
              onSelect={handleSelect}
              onRemove={remove}
              mode={mode}
              selected={selected}
              onToggle={handleToggleEntry}
            />
          </>
        )}
      </div>

      {mode === "select" && selected.size >= 1 && (
        <div className="fixed bottom-6 right-6">
          <button
            type="button"
            onClick={handleCompareSelected}
            className="rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg"
            style={{ backgroundColor: "#E65100" }}
          >
            Add to compare ({selected.size})
          </button>
        </div>
      )}
    </main>
  );
}
