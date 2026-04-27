"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompareSet } from "@/lib/useCompareSet";
import { getCompareColor } from "@/lib/compareSet";
import { resolveQuery } from "@/lib/resolveQuery";
import type { CompareEntry, PostcodeData } from "@/lib/types";
import CompareSetChip from "@/components/CompareSetChip";
import CompareColumns, { type CompareColumn } from "@/components/CompareColumns";
import CompareStatTable, {
  type StatSection,
} from "@/components/CompareStatTable";
import CompareElectionChart from "@/components/CompareElectionChart";
import CompareMigrationChart from "@/components/CompareMigrationChart";

type Resolution = {
  entry: CompareEntry;
  data: PostcodeData | null;
  status: "loading" | "ok" | "error";
};

function formatEuro(n: number): string {
  return "€" + n.toLocaleString("nl-NL");
}
function formatNumber(n: number): string {
  return n.toLocaleString("nl-NL");
}
function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}
function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters.toFixed(0)} m`;
}

function familiesWithKidsPercent(d: PostcodeData): number | null {
  const hc = d.householdComposition;
  if (!hc) return null;
  const sum = hc.single + hc.withoutKids + hc.withKids;
  return sum > 0 ? (hc.withKids / sum) * 100 : null;
}

function ownershipPercents(d: PostcodeData): { koop: number; huur: number } | null {
  const o = d.housingTypes?.ownership;
  if (!o) return null;
  const total = o.koop + o.huur;
  if (total === 0) return null;
  return { koop: (o.koop / total) * 100, huur: (o.huur / total) * 100 };
}

function distanceInMeters(d: { distance: number; unit: string }): number | null {
  if (typeof d.distance !== "number") return null;
  // existing scrape uses "m" for meters and "km" for kilometers
  if (d.unit === "km") return d.distance * 1000;
  return d.distance;
}

function buildingTypePercents(d: PostcodeData): Record<string, number> | null {
  const map = d.housingTypes?.buildingType;
  if (!map) return null;
  const total = Object.values(map).reduce((sum, v) => sum + v, 0);
  if (total === 0) return null;
  const out: Record<string, number> = {};
  for (const [name, count] of Object.entries(map)) {
    out[name] = (count / total) * 100;
  }
  return out;
}

async function fetchOne(entry: CompareEntry): Promise<PostcodeData | null> {
  try {
    const result = await resolveQuery(entry.query);
    if (result.kind === "area") {
      const params = new URLSearchParams({
        code: result.code,
        areaCode: result.areaCode,
      });
      const res = await fetch(
        `/api/area/${result.areaType}/${result.slug}?${params}`
      );
      if (res.ok) return (await res.json()) as PostcodeData;
      // Fall back to postcode if the buurt/wijk page isn't on allecijfers
      if (result.code !== "0000") {
        const fallback = await fetch(`/api/postcode/${result.code}`);
        if (fallback.ok) return (await fallback.json()) as PostcodeData;
      }
      return null;
    } else {
      const res = await fetch(`/api/postcode/${result.code}`);
      if (!res.ok) return null;
      return (await res.json()) as PostcodeData;
    }
  } catch {
    return null;
  }
}

export default function ComparePage() {
  const { entries, remove, clear } = useCompareSet();

  const loadingResolutions = useMemo<Resolution[]>(
    () => entries.map((entry) => ({ entry, data: null, status: "loading" })),
    [entries]
  );

  const [resolutions, setResolutions] = useState<Resolution[]>(loadingResolutions);

  useEffect(() => {
    let cancelled = false;
    setResolutions(loadingResolutions);

    Promise.all(
      entries.map(async (entry) => {
        const data = await fetchOne(entry);
        return { entry, data, status: data ? "ok" : "error" } as Resolution;
      })
    ).then((results) => {
      if (cancelled) return;
      setResolutions(results);
    });

    return () => {
      cancelled = true;
    };
    // loadingResolutions is derived from entries; listing entries is sufficient
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const handleRetry = useCallback(async (query: string) => {
    const target = entries.find((e) => e.query === query);
    if (!target) return;
    setResolutions((prev) =>
      prev.map((r) =>
        r.entry.query === query ? { ...r, data: null, status: "loading" } : r
      )
    );
    const data = await fetchOne(target);
    setResolutions((prev) =>
      prev.map((r) =>
        r.entry.query === query
          ? { entry: r.entry, data, status: data ? "ok" : "error" }
          : r
      )
    );
  }, [entries]);

  const columns: CompareColumn[] = resolutions.map((r, i) => ({
    entry: r.entry,
    color: getCompareColor(i),
    sublabel: r.data?.location,
    status: r.status,
  }));

  // Per-buurt percentages keyed by building-type name. Computed once so
  // both the row generator and the union calculation share the same view.
  const buildingTypePcts = resolutions.map((r) =>
    r.data ? buildingTypePercents(r.data) : null
  );
  // Union of building-type names across selected buurts, ordered by total
  // share (largest combined % first) so the most-common types appear first.
  const buildingTypeOrder = (() => {
    const totals = new Map<string, number>();
    for (const pcts of buildingTypePcts) {
      if (!pcts) continue;
      for (const [name, pct] of Object.entries(pcts)) {
        totals.set(name, (totals.get(name) ?? 0) + pct);
      }
    }
    return [...totals.keys()].sort(
      (a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0)
    );
  })();

  const statSections: StatSection[] = [
    {
      heading: "Quick stats",
      rows: [
        {
          label: "Avg WOZ value",
          values: resolutions.map((r) => r.data?.quickStats.wozValue.value ?? null),
          format: formatEuro,
          direction: "lower",
        },
        {
          label: "Avg income",
          values: resolutions.map((r) => r.data?.quickStats.avgIncome.value ?? null),
          format: formatEuro,
          direction: "higher",
        },
        {
          label: "Population",
          values: resolutions.map((r) => r.data?.quickStats.population.value ?? null),
          format: formatNumber,
          direction: "none",
        },
        {
          label: "Families with kids",
          values: resolutions.map((r) => (r.data ? familiesWithKidsPercent(r.data) : null)),
          format: formatPercent,
          direction: "higher",
        },
      ],
    },
    {
      heading: "Housing",
      rows: [
        {
          label: "Owner-occupied (koop)",
          values: resolutions.map((r) => (r.data ? ownershipPercents(r.data)?.koop ?? null : null)),
          format: formatPercent,
          direction: "higher",
        },
        {
          label: "Rental (huur)",
          values: resolutions.map((r) => (r.data ? ownershipPercents(r.data)?.huur ?? null : null)),
          format: formatPercent,
          direction: "none",
        },
        ...buildingTypeOrder.map((name) => ({
          label: name,
          values: buildingTypePcts.map((pcts) => pcts?.[name] ?? null),
          format: formatPercent,
          direction: "none" as const,
        })),
      ],
    },
    {
      heading: "Distance to amenities",
      rows: [
        {
          label: "Supermarket",
          values: resolutions.map((r) => (r.data ? distanceInMeters(r.data.amenities.supermarket) : null)),
          format: formatDistance,
          direction: "lower",
        },
        {
          label: "GP / huisarts",
          values: resolutions.map((r) => (r.data ? distanceInMeters(r.data.amenities.gp) : null)),
          format: formatDistance,
          direction: "lower",
        },
        {
          label: "Primary school",
          values: resolutions.map((r) => (r.data ? distanceInMeters(r.data.amenities.primarySchool) : null)),
          format: formatDistance,
          direction: "lower",
        },
      ],
    },
  ];

  function handleClearAll() {
    if (entries.length === 0) return;
    if (window.confirm("Clear the comparison set?")) {
      clear();
    }
  }

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
              Buurtje
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back
            </Link>
            <CompareSetChip />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-900">Compare buurts</h1>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No buurts to compare yet.{" "}
            <Link href="/" className="font-semibold" style={{ color: "#E65100" }}>
              Search and add some →
            </Link>
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">
            {entries.length} of 4 selected ·{" "}
            <Link href="/" className="font-semibold" style={{ color: "#E65100" }}>
              + Add another
            </Link>
            {" · "}
            <button
              type="button"
              onClick={handleClearAll}
              className="font-semibold text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          </p>
        )}
      </div>

      {entries.length === 1 && (
        <p className="mb-4 rounded-lg border border-orange-100 bg-orange-50 px-4 py-2 text-xs text-orange-800">
          Add another buurt from the{" "}
          <Link href="/" className="font-semibold underline">
            home page
          </Link>{" "}
          to compare side-by-side.
        </p>
      )}

      {entries.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${200 + resolutions.length * 140}px` }}>
              <CompareColumns columns={columns} onRemove={remove} onRetry={handleRetry} />
              <div className="mt-2">
                <CompareStatTable
                  sections={statSections}
                  columnCount={resolutions.length}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-4 grid gap-4">
          <CompareElectionChart
            columns={resolutions.map((r, i) => ({
              entry: r.entry,
              color: getCompareColor(i),
              data: r.data,
            }))}
          />
          <CompareMigrationChart
            columns={resolutions.map((r, i) => ({
              entry: r.entry,
              color: getCompareColor(i),
              data: r.data,
            }))}
          />
        </div>
      )}
    </main>
  );
}
