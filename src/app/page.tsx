"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PostcodeData, HistoryEntry } from "@/lib/types";
import { addToHistory } from "@/lib/history";
import PostcodeSearch from "@/components/PostcodeSearch";
import QuickStats from "@/components/QuickStats";
import Amenities from "@/components/Amenities";
import Migration from "@/components/Migration";
import HousingTypes from "@/components/HousingTypes";
import ElectionResults from "@/components/ElectionResults";
import AreaMap from "@/components/AreaMap";

const PDOK_BASE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pdokSearch(query: string, fq: string, fl?: string): Promise<any> {
  const params = new URLSearchParams({ q: query, fq, rows: "1" });
  if (fl) params.set("fl", fl);
  const res = await fetch(`${PDOK_BASE}/free?${params}`);
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((await res.json()) as any).response?.docs?.[0] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pdokReverse(lat: number, lon: number): Promise<any> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    rows: "1",
    type: "adres",
    fl: "postcode,weergavenaam",
  });
  const res = await fetch(`${PDOK_BASE}/reverse?${params}`);
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((await res.json()) as any).response?.docs?.[0] ?? null;
}

function parseCoords(centroide: string): { lat: number; lon: number } | null {
  const m = centroide.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
  return m ? { lon: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

type SearchResult =
  | { kind: "postcode"; code: string; label?: string }
  | {
      kind: "area";
      areaType: "buurt" | "wijk";
      slug: string;
      code: string;
      areaCode: string;
      label: string;
      geometrieWkt: string;
    };

type MapContext =
  | { kind: "postcode"; code: string }
  | { kind: "buurt" | "wijk"; geometrieWkt: string; label: string };

async function resolveQuery(query: string): Promise<SearchResult> {
  if (/^\d{4}$/.test(query)) {
    return { kind: "postcode", code: query };
  }

  // 1. Try as buurt/wijk first (neighborhood search is the new priority)
  const buurtDoc = await pdokSearch(
    query,
    "type:buurt OR type:wijk",
    "weergavenaam,centroide_ll,geometrie_ll,buurtnaam,wijknaam,gemeentenaam,type,buurtcode,wijkcode"
  );
  if (buurtDoc?.centroide_ll && buurtDoc?.gemeentenaam) {
    const coords = parseCoords(buurtDoc.centroide_ll);
    if (coords) {
      const reverseDoc = await pdokReverse(coords.lat, coords.lon);
      const code = reverseDoc?.postcode?.substring(0, 4) ?? "0000";
      const areaType = buurtDoc.type as "buurt" | "wijk";
      const name = areaType === "buurt" ? buurtDoc.buurtnaam : buurtDoc.wijknaam;
      const slug = `${toSlug(name)}-${toSlug(buurtDoc.gemeentenaam)}`;
      const areaCode =
        areaType === "buurt" ? buurtDoc.buurtcode : buurtDoc.wijkcode;
      return {
        kind: "area",
        areaType,
        slug,
        code,
        areaCode: areaCode || "",
        label: buurtDoc.weergavenaam,
        geometrieWkt: buurtDoc.geometrie_ll ?? "",
      };
    }
  }

  // 2. Try as address
  const adresDoc = await pdokSearch(query, "type:adres", "postcode,weergavenaam");
  if (adresDoc?.postcode) {
    return {
      kind: "postcode",
      code: adresDoc.postcode.substring(0, 4),
      label: adresDoc.weergavenaam,
    };
  }

  // 3. Try as woonplaats
  const plaatsDoc = await pdokSearch(query, "type:woonplaats", "weergavenaam,centroide_ll");
  if (plaatsDoc?.centroide_ll) {
    const coords = parseCoords(plaatsDoc.centroide_ll);
    if (coords) {
      const reverseDoc = await pdokReverse(coords.lat, coords.lon);
      if (reverseDoc?.postcode) {
        return {
          kind: "postcode",
          code: reverseDoc.postcode.substring(0, 4),
          label: plaatsDoc.weergavenaam,
        };
      }
    }
  }

  throw new Error("Address not found");
}

function HomeContent() {
  const [data, setData] = useState<PostcodeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchedLabel, setMatchedLabel] = useState<string | null>(null);
  const [areaType, setAreaType] = useState<string | null>(null);
  const [mapContext, setMapContext] = useState<MapContext | null>(null);
  const searchParams = useSearchParams();
  const autoSearchedRef = useRef(false);

  async function handleSearch(query: string) {
    setIsLoading(true);
    setError(null);
    setData(null);
    setMatchedLabel(null);
    setAreaType(null);
    setMapContext(null);

    try {
      const result = await resolveQuery(query);

      if (result.kind === "area") {
        setMatchedLabel(result.label);
        setAreaType(result.areaType);
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
          <Link
            href="/history"
            className="text-sm font-semibold"
            style={{ color: "#E65100" }}
          >
            History
          </Link>
        </div>
        <PostcodeSearch onSearch={handleSearch} isLoading={isLoading} />
        {data && !isLoading && (
          <div className="mt-3">
            {matchedLabel && (
              <p className="text-sm text-gray-500">
                Matched: {matchedLabel}
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
