"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SchoolsMap from "@/components/SchoolsMap";
import SchoolsTable, { type SortState } from "@/components/SchoolsTable";
import { buurtKey } from "@/lib/mapHelpers";
import { isBelowAverage, isLowScoring, vwoPercent } from "@/lib/schoolStats";
import type { SchoolIndexEntry, SchoolScore } from "@/lib/types";

type GemeenteAverages = {
  gemeente: { name: string; scores: SchoolScore[] };
};

const GEMEENTEN = [
  { slug: "haarlem", label: "Haarlem" },
  { slug: "amsterdam", label: "Amsterdam" },
  { slug: "amstelveen", label: "Amstelveen" },
  { slug: "hilversum", label: "Hilversum" },
];

const VALID_SLUGS = new Set(GEMEENTEN.map((g) => g.slug));
const DEFAULT_SLUG = "haarlem";

function SchoolsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("gemeente");
  const slug = raw && VALID_SLUGS.has(raw) ? raw : DEFAULT_SLUG;

  const [buurten, setBuurten] = useState<GeoJSON.FeatureCollection | null>(null);
  const [schools, setSchools] = useState<SchoolIndexEntry[] | null>(null);
  const [gemeenteScores, setGemeenteScores] = useState<SchoolScore[]>([]);
  const [error, setError] = useState<string | null>(null);

  // URL is the source of truth for the selection; derive a Set for fast lookup.
  const buurtenParam = searchParams.get("buurten");
  const selectedBuurtKeys = useMemo(
    () =>
      new Set(
        buurtenParam ? buurtenParam.split(",").map((s) => s.trim()).filter(Boolean) : []
      ),
    [buurtenParam]
  );

  // Sort: only VWO% supported today; null param means "default order".
  const sortParam = searchParams.get("sort");
  const dirParam = searchParams.get("dir");
  const sort: SortState =
    sortParam === "vwo"
      ? { col: "vwo", dir: dirParam === "asc" ? "asc" : "desc" }
      : null;

  // Denominatie filter:
  //   no `denominaties` param      → null = no filter (show all)
  //   `?denominaties=A,B`          → only those values shown
  //   `?denominaties=` (empty)     → empty Set = nothing shown
  const denomParam = searchParams.get("denominaties");
  const selectedDenominaties = useMemo<Set<string> | null>(() => {
    if (denomParam === null) return null;
    return new Set(denomParam.split(",").filter(Boolean));
  }, [denomParam]);

  useEffect(() => {
    let cancelled = false;
    setBuurten(null);
    setSchools(null);
    setGemeenteScores([]);
    setError(null);
    Promise.all([
      fetch(`/buurten/${slug}.json`).then((r) =>
        r.ok ? (r.json() as Promise<GeoJSON.FeatureCollection>) : Promise.reject(r.status)
      ),
      fetch(`/schools/${slug}/index.json`).then((r) =>
        r.ok ? (r.json() as Promise<SchoolIndexEntry[]>) : Promise.reject(r.status)
      ),
      // averages.json is best-effort — degrade gracefully if missing.
      fetch(`/schools/${slug}/averages.json`).then((r) =>
        r.ok ? (r.json() as Promise<GemeenteAverages>) : null
      ),
    ])
      .then(([b, s, a]) => {
        if (cancelled) return;
        setBuurten(b);
        setSchools(s);
        setGemeenteScores(a?.gemeente?.scores ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load gemeente data");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function selectGemeente(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("gemeente", next);
    // Switching gemeente clears the buurt selection — slugs from the previous
    // gemeente wouldn't match anything in the new one anyway.
    params.delete("buurten");
    router.replace(`/schools?${params.toString()}`, { scroll: false });
  }

  const toggleBuurt = useCallback(
    (key: string) => {
      const next = new Set(selectedBuurtKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      const params = new URLSearchParams(searchParams.toString());
      if (next.size) params.set("buurten", [...next].sort().join(","));
      else params.delete("buurten");
      router.replace(`/schools?${params.toString()}`, { scroll: false });
    },
    [selectedBuurtKeys, searchParams, router]
  );

  // Available denominaties for the filter dropdown — derived from the loaded
  // gemeente, sorted alphabetically. Stable across buurt selection so the
  // dropdown doesn't appear/disappear options as the user clicks polygons.
  const availableDenominaties = useMemo(() => {
    if (!schools) return [];
    return Array.from(
      new Set(schools.map((s) => s.denominatie).filter((d): d is string => !!d))
    ).sort();
  }, [schools]);

  const cycleSort = useCallback(
    (col: "vwo") => {
      const params = new URLSearchParams(searchParams.toString());
      // Cycle: none → desc → asc → none
      if (sort === null || sort.col !== col) {
        params.set("sort", col);
        params.set("dir", "desc");
      } else if (sort.dir === "desc") {
        params.set("sort", col);
        params.set("dir", "asc");
      } else {
        params.delete("sort");
        params.delete("dir");
      }
      router.replace(`/schools?${params.toString()}`, { scroll: false });
    },
    [sort, searchParams, router]
  );

  const setDenominatiesParam = useCallback(
    (next: Set<string> | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === null) {
        params.delete("denominaties");
      } else {
        params.set("denominaties", [...next].sort().join(","));
      }
      router.replace(`/schools?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  const toggleDenominatie = useCallback(
    (denom: string) => {
      // If no current filter (null), behave as if all are checked — toggling
      // means unchecking this one only.
      const current =
        selectedDenominaties ?? new Set(availableDenominaties);
      const next = new Set(current);
      if (next.has(denom)) next.delete(denom);
      else next.add(denom);
      // Collapse "all selected" back to null (no filter) for a clean URL.
      const allSelected =
        next.size === availableDenominaties.length &&
        availableDenominaties.every((d) => next.has(d));
      setDenominatiesParam(allSelected ? null : next);
    },
    [selectedDenominaties, availableDenominaties, setDenominatiesParam]
  );

  const selectAllDenominaties = useCallback(
    () => setDenominatiesParam(null),
    [setDenominatiesParam]
  );
  const clearAllDenominaties = useCallback(
    () => setDenominatiesParam(new Set()),
    [setDenominatiesParam]
  );

  // Schools shown in the table: apply buurt filter → denom filter → sort.
  const filteredSchools = useMemo(() => {
    if (!schools) return null;
    let list: SchoolIndexEntry[] = schools;

    if (selectedBuurtKeys.size > 0) {
      list = list.filter(
        (s) => s.buurt != null && selectedBuurtKeys.has(buurtKey(s.buurt))
      );
    }

    if (selectedDenominaties !== null) {
      list = list.filter(
        (s) => s.denominatie != null && selectedDenominaties.has(s.denominatie)
      );
    }

    if (sort?.col === "vwo") {
      const dir = sort.dir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const va = vwoPercent(a.latestAdvies);
        const vb = vwoPercent(b.latestAdvies);
        // Schools with no VWO% always sort to the end, regardless of dir.
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return (va - vb) * dir;
      });
    }

    return list;
  }, [schools, selectedBuurtKeys, selectedDenominaties, sort]);

  // `lowScoreSlugs`: no published score OR below gemeente average — used,
  // along with the denominatie-filtered-out set, to grey out map markers.
  // `belowAverageSlugs`: strictly below gemeente average (excludes no-score)
  // — used for the score-cell highlight in the table.
  const lowScoreSlugs = useMemo(() => {
    if (!schools) return new Set<string>();
    return new Set(
      schools.filter((s) => isLowScoring(s, gemeenteScores)).map((s) => s.slug)
    );
  }, [schools, gemeenteScores]);
  const belowAverageSlugs = useMemo(() => {
    if (!schools) return new Set<string>();
    return new Set(
      schools.filter((s) => isBelowAverage(s, gemeenteScores)).map((s) => s.slug)
    );
  }, [schools, gemeenteScores]);
  // Schools the active denominatie filter excludes — empty when no filter.
  const denomFilteredOutSlugs = useMemo(() => {
    if (!schools || selectedDenominaties === null) return new Set<string>();
    return new Set(
      schools
        .filter(
          (s) => !s.denominatie || !selectedDenominaties.has(s.denominatie)
        )
        .map((s) => s.slug)
    );
  }, [schools, selectedDenominaties]);
  // Union: any school the map should de-emphasise.
  const mutedSlugs = useMemo(
    () => new Set([...lowScoreSlugs, ...denomFilteredOutSlugs]),
    [lowScoreSlugs, denomFilteredOutSlugs]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: "#E65100" }}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Buurtje · Schools
            </span>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold"
            style={{ color: "#E65100" }}
          >
            Home
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {GEMEENTEN.map((g) => {
            const active = g.slug === slug;
            return (
              <button
                key={g.slug}
                type="button"
                onClick={() => selectGemeente(g.slug)}
                className={
                  active
                    ? "rounded-md px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                }
                style={active ? { backgroundColor: "#E65100" } : undefined}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        {selectedBuurtKeys.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="font-medium">Selected buurten:</span>
            {[...selectedBuurtKeys].sort().map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleBuurt(k)}
                className="rounded-full border border-gray-200 px-2 py-0.5 hover:bg-gray-50"
                title="Click to remove"
              >
                {k} ✕
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <SchoolsMap
            buurten={buurten}
            schools={schools}
            selectedBuurtKeys={selectedBuurtKeys}
            onBuurtToggle={toggleBuurt}
            mutedSlugs={mutedSlugs}
          />
          <SchoolsTable
            schools={filteredSchools}
            belowAverageSlugs={belowAverageSlugs}
            sort={sort}
            onCycleSort={cycleSort}
            availableDenominaties={availableDenominaties}
            selectedDenominaties={selectedDenominaties}
            onToggleDenominatie={toggleDenominatie}
            onSelectAllDenominaties={selectAllDenominaties}
            onClearAllDenominaties={clearAllDenominaties}
          />
        </div>
      )}
    </main>
  );
}

export default function SchoolsPage() {
  return (
    <Suspense fallback={null}>
      <SchoolsPageContent />
    </Suspense>
  );
}
