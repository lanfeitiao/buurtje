"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import SchoolsMap from "@/components/SchoolsMap";
import SchoolsTable from "@/components/SchoolsTable";
import { buurtKey } from "@/lib/mapHelpers";
import { isBelowAverage, isLowScoring } from "@/lib/schoolStats";
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
    router.replace(`/schools?${params.toString()}`);
  }

  const toggleBuurt = useCallback(
    (key: string) => {
      const next = new Set(selectedBuurtKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      const params = new URLSearchParams(searchParams.toString());
      if (next.size) params.set("buurten", [...next].sort().join(","));
      else params.delete("buurten");
      router.replace(`/schools?${params.toString()}`);
    },
    [selectedBuurtKeys, searchParams, router]
  );

  // Schools shown in the table: filtered by selection, or all when empty.
  const filteredSchools = useMemo(() => {
    if (!schools) return null;
    if (selectedBuurtKeys.size === 0) return schools;
    return schools.filter(
      (s) => s.buurt != null && selectedBuurtKeys.has(buurtKey(s.buurt))
    );
  }, [schools, selectedBuurtKeys]);

  // `lowScoreSlugs`: no published score OR below gemeente average — used to
  // grey out the map marker. `belowAverageSlugs`: strictly below gemeente
  // average (excludes no-score) — used for the score-cell highlight in the
  // table, since "lower than average" implies a numeric comparison.
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
            lowScoreSlugs={lowScoreSlugs}
          />
          <SchoolsTable
            schools={filteredSchools}
            belowAverageSlugs={belowAverageSlugs}
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
