"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PostcodeData, HistoryEntry } from "@/lib/types";
import { resolveQuery, type MapContext } from "@/lib/resolveQuery";
import { addToHistory } from "@/lib/history";
import PostcodeSearch from "@/components/PostcodeSearch";
import QuickStats from "@/components/QuickStats";
import Amenities from "@/components/Amenities";
import Migration from "@/components/Migration";
import HousingTypes from "@/components/HousingTypes";
import ElectionResults from "@/components/ElectionResults";
import AreaMap from "@/components/AreaMap";
import CompareSetChip from "@/components/CompareSetChip";
import CompareSetButton from "@/components/CompareSetButton";

function HomeContent() {
  const [data, setData] = useState<PostcodeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchedLabel, setMatchedLabel] = useState<string | null>(null);
  const [areaType, setAreaType] = useState<string | null>(null);
  const [buurtName, setBuurtName] = useState<string | null>(null);
  const [mapContext, setMapContext] = useState<MapContext | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const searchParams = useSearchParams();
  const autoSearchedRef = useRef(false);

  async function handleSearch(query: string) {
    setIsLoading(true);
    setError(null);
    setData(null);
    setMatchedLabel(null);
    setAreaType(null);
    setBuurtName(null);
    setMapContext(null);

    try {
      setLastQuery(query);
      const result = await resolveQuery(query);

      if (result.kind === "area") {
        setMatchedLabel(result.label);
        setAreaType(result.areaType);
        setBuurtName(result.buurtName ?? null);
        setMapContext({
          kind: result.areaType,
          geometrieWkt: result.geometrieWkt,
          label: result.label,
        });
        // Fetch buurt/wijk-specific data
        const params = new URLSearchParams({
          code: result.code,
          areaCode: result.areaCode,
        });
        const res = await fetch(
          `/api/area/${result.areaType}/${result.slug}?${params}`
        );
        if (res.ok) {
          const json: PostcodeData = await res.json();
          setData(json);
          const entry: HistoryEntry = {
            query,
            label: result.label,
            kind: result.areaType,
            timestamp: Date.now(),
          };
          addToHistory(entry);
          return;
        }
        // Fallback: buurt/wijk page not found on allecijfers.nl —
        // show postcode-level data instead
        if (result.code !== "0000") {
          setAreaType(null);
          setBuurtName(null);
          setMapContext({ kind: "postcode", code: result.code });
          const fallback = await fetch(`/api/postcode/${result.code}`);
          if (fallback.ok) {
            const json: PostcodeData = await fallback.json();
            setData(json);
            setMatchedLabel(`${result.label} (showing postcode ${result.code})`);
            // Save the original area entry, not the postcode fallback —
            // history should reflect what the user searched for.
            const entry: HistoryEntry = {
              query,
              label: result.label,
              kind: result.areaType,
              timestamp: Date.now(),
            };
            addToHistory(entry);
            return;
          }
        }
        setError(`No data found for ${result.label}.`);
      } else {
        if (result.label) setMatchedLabel(result.label);
        setMapContext({ kind: "postcode", code: result.code });
        const res = await fetch(`/api/postcode/${result.code}`);
        if (!res.ok) {
          setError(`No data found for postcode ${result.code}.`);
          return;
        }
        const json: PostcodeData = await res.json();
        setData(json);
        const entry: HistoryEntry = {
          query,
          label: result.label ?? result.code,
          kind: "postcode",
          timestamp: Date.now(),
        };
        addToHistory(entry);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "Address not found") {
        setError("Not found. Try a postcode, address, or neighborhood name.");
      } else {
        setError("Network error. Please check your connection.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (autoSearchedRef.current) return;
    const q = searchParams.get("q");
    if (q && q.trim().length >= 2) {
      autoSearchedRef.current = true;
      handleSearch(q.trim());
    }
  }, [searchParams]);

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
            <Link
              href="/history"
              className="text-sm font-semibold"
              style={{ color: "#E65100" }}
            >
              History
            </Link>
            <CompareSetChip />
          </div>
        </div>
        <PostcodeSearch onSearch={handleSearch} isLoading={isLoading} />
        {data && !isLoading && (
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              {matchedLabel && (
                <p className="text-sm text-gray-500">
                  Matched: {matchedLabel}
                  {buurtName && (
                    <>
                      {" · "}
                      <span className="font-medium text-gray-700">{buurtName}</span>
                    </>
                  )}
                  {areaType && (
                    <span className="ml-2 rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-orange-600">
                      {areaType}
                    </span>
                  )}
                </p>
              )}
              <p className="text-sm text-gray-600">
                Showing results for{" "}
                <span className="font-semibold" style={{ color: "#E65100" }}>
                  {data.code}
                </span>{" "}
                — {data.location}
              </p>
            </div>
            <CompareSetButton
              query={lastQuery}
              label={matchedLabel?.replace(/ \(showing postcode .*\)$/, "") ?? data.code}
              kind={(areaType as "buurt" | "wijk" | null) ?? "postcode"}
            />
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {data && !isLoading && (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            <QuickStats data={data} />
            <Amenities data={data} />
            <Migration data={data} />
            <HousingTypes data={data} />
            <ElectionResults data={data} />
          </div>
          {mapContext && (
            <div className="lg:sticky lg:top-4 lg:self-start">
              <AreaMap context={mapContext} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
