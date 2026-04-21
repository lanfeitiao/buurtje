# Interactive Map with Two-Column Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-column layout into a two-column layout with a sticky interactive map, and add school/supermarket POI markers via Overpass API.

**Architecture:** The existing `PostcodeMap` component is extended to support a default Netherlands view, Overpass POI fetching, and toggle buttons. The page layout (`page.tsx`) is restructured from a single-column `max-w-3xl` to a two-column grid with `max-w-6xl`, where the left column scrolls and the right column is sticky. An `overpass.ts` utility handles Overpass API queries.

**Tech Stack:** Next.js 16, React 19, Leaflet 1.9, Tailwind CSS 4, Overpass API (OpenStreetMap)

**Spec:** `docs/superpowers/specs/2026-04-21-interactive-map-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/overpass.ts` | Create | Overpass API query + response parsing |
| `src/components/PostcodeMap.tsx` | Modify | Default NL view, sticky height, POI toggles, markers |
| `src/app/page.tsx` | Modify | Two-column grid layout, always-render map |
| `__tests__/overpass.test.ts` | Create | Unit tests for Overpass query builder and parser |

---

## Task 1: Overpass API Utility

**Files:**
- Create: `src/lib/overpass.ts`
- Create: `__tests__/overpass.test.ts`

This task builds the Overpass API integration as a standalone utility — query building, fetching, and response parsing.

- [ ] **Step 1: Write the failing test for `buildOverpassQuery`**

Create `__tests__/overpass.test.ts`:

```typescript
import { buildOverpassQuery, parseOverpassResponse } from "@/lib/overpass";

describe("buildOverpassQuery", () => {
  it("builds a query for schools within a bounding box", () => {
    const query = buildOverpassQuery("school", [52.0, 4.3, 52.1, 4.4]);
    expect(query).toContain('[out:json]');
    expect(query).toContain('"amenity"="school"');
    expect(query).toContain("52.0,4.3,52.1,4.4");
  });

  it("builds a query for supermarkets within a bounding box", () => {
    const query = buildOverpassQuery("supermarket", [52.0, 4.3, 52.1, 4.4]);
    expect(query).toContain('"shop"="supermarket"');
    expect(query).toContain("52.0,4.3,52.1,4.4");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/overpass.test.ts --no-cache`
Expected: FAIL — `Cannot find module '@/lib/overpass'`

- [ ] **Step 3: Implement `buildOverpassQuery` and `parseOverpassResponse`**

Create `src/lib/overpass.ts`:

```typescript
export interface POI {
  id: number;
  name: string | null;
  lat: number;
  lon: number;
}

export type POIType = "school" | "supermarket";

// Bounding box format: [south, west, north, east]
export type BBox = [number, number, number, number];

const TAG_MAP: Record<POIType, string> = {
  school: '["amenity"="school"]',
  supermarket: '["shop"="supermarket"]',
};

export function buildOverpassQuery(type: POIType, bbox: BBox): string {
  const tag = TAG_MAP[type];
  const b = bbox.join(",");
  return `[out:json][timeout:10];(node${tag}(${b});way${tag}(${b}););out center;`;
}

export function parseOverpassResponse(data: { elements: Array<{ id: number; tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }> }): POI[] {
  return data.elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;
      return {
        id: el.id,
        name: el.tags?.name ?? null,
        lat,
        lon,
      };
    })
    .filter((p): p is POI => p !== null);
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function fetchPOIs(type: POIType, bbox: BBox): Promise<POI[]> {
  const query = buildOverpassQuery(type, bbox);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
  const json = await res.json();
  return parseOverpassResponse(json);
}
```

- [ ] **Step 4: Write tests for `parseOverpassResponse`**

Add to `__tests__/overpass.test.ts`:

```typescript
describe("parseOverpassResponse", () => {
  it("parses nodes with lat/lon", () => {
    const result = parseOverpassResponse({
      elements: [
        { id: 1, lat: 52.1, lon: 4.3, tags: { name: "School A" } },
        { id: 2, lat: 52.2, lon: 4.4, tags: {} },
      ],
    });
    expect(result).toEqual([
      { id: 1, name: "School A", lat: 52.1, lon: 4.3 },
      { id: 2, name: null, lat: 52.2, lon: 4.4 },
    ]);
  });

  it("parses ways with center coordinates", () => {
    const result = parseOverpassResponse({
      elements: [
        { id: 3, center: { lat: 52.3, lon: 4.5 }, tags: { name: "Big School" } },
      ],
    });
    expect(result).toEqual([
      { id: 3, name: "Big School", lat: 52.3, lon: 4.5 },
    ]);
  });

  it("skips elements with no coordinates", () => {
    const result = parseOverpassResponse({
      elements: [{ id: 4, tags: { name: "Ghost" } }],
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 5: Run all tests to verify they pass**

Run: `npx jest __tests__/overpass.test.ts --no-cache`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/overpass.ts __tests__/overpass.test.ts
git commit -m "feat: add Overpass API utility for fetching school/supermarket POIs"
```

---

## Task 2: Refactor PostcodeMap to Support Default NL View

**Files:**
- Modify: `src/components/PostcodeMap.tsx`

This task changes the map component to accept `postcode: string | null`, render a default Netherlands view when null, and use responsive height.

- [ ] **Step 1: Update the props interface and default view logic**

Replace the entire content of `src/components/PostcodeMap.tsx` with:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

interface PostcodeMapProps {
  postcode: string | null;
}

const NL_CENTER: [number, number] = [52.2, 5.3];
const NL_ZOOM = 7;

export default function PostcodeMap({ postcode }: PostcodeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize map once (default NL view)
  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: window.innerWidth >= 768,
      });
      mapInstanceRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a> | Boundaries: &copy; CBS, &copy; ESRI Nederland',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      map.setView(NL_CENTER, NL_ZOOM);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update boundary when postcode changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let cancelled = false;

    async function updateBoundary() {
      const L = (await import("leaflet")).default;
      const topojson = await import("topojson-client");

      if (cancelled || !mapInstanceRef.current) return;

      // Remove old boundary
      if (boundaryLayerRef.current) {
        boundaryLayerRef.current.remove();
        boundaryLayerRef.current = null;
      }

      if (!postcode) {
        setError(null);
        mapInstanceRef.current.setView(NL_CENTER, NL_ZOOM);
        return;
      }

      const res = await fetch("/postcode4_2024.topojson");
      if (!res.ok) {
        setError("Could not load map data");
        return;
      }
      const topo: any = await res.json();

      if (cancelled) return;

      const objectKey = Object.keys(topo.objects)[0];
      const geojson = topojson.feature(
        topo,
        topo.objects[objectKey]
      ) as unknown as GeoJSON.FeatureCollection;

      const pc = parseInt(postcode, 10);
      const feature = geojson.features.find(
        (f) => f.properties?.postcode === pc
      );

      if (!feature) {
        setError("Postcode area not found on map");
        return;
      }

      setError(null);

      const layer = L.geoJSON(feature, {
        style: {
          color: "#E65100",
          weight: 3,
          dashArray: "8, 6",
          fillColor: "#E65100",
          fillOpacity: 0.08,
          opacity: 0.9,
        },
      }).addTo(mapInstanceRef.current);

      boundaryLayerRef.current = layer;
      mapInstanceRef.current.fitBounds(layer.getBounds(), { padding: [30, 30] });
    }

    updateBoundary();

    return () => {
      cancelled = true;
    };
  }, [postcode]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden relative">
      {error && (
        <div className="absolute top-2 left-2 z-[1000] bg-white/90 rounded px-2 py-1">
          <p className="text-xs text-gray-400">{error}</p>
        </div>
      )}
      <div
        ref={mapRef}
        className="w-full h-[300px] md:h-[calc(100vh-2rem)]"
      />
    </div>
  );
}
```

Key changes from the original:
- `postcode` prop is now `string | null`
- Map initializes once (no destroy/recreate on postcode change)
- Two separate `useEffect`s: one for map init, one for boundary updates
- `boundaryLayerRef` tracks the boundary layer for clean removal
- Responsive height via Tailwind: `h-[300px] md:h-[calc(100vh-2rem)]`
- `scrollWheelZoom` enabled on desktop only (`window.innerWidth >= 768`)
- Error shown as overlay instead of replacing the entire map
- Default NL view when `postcode` is `null`

- [ ] **Step 2: Verify the dev server starts without errors**

Run: `npm run dev`
Open the app in a browser. Confirm:
- The map renders at the Netherlands zoom level on page load
- The map fills the expected height

- [ ] **Step 3: Commit**

```bash
git add src/components/PostcodeMap.tsx
git commit -m "refactor: PostcodeMap supports default NL view and responsive height"
```

---

## Task 3: Two-Column Page Layout

**Files:**
- Modify: `src/app/page.tsx`

This task restructures `page.tsx` from single-column to a two-column grid layout, with the map always rendered.

- [ ] **Step 1: Restructure the JSX return block**

In `src/app/page.tsx`, replace the entire `return (...)` block of the `Home` component (lines 191–248) with:

```tsx
  return (
    <main className="mx-auto max-w-6xl px-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr,minmax(0,500px)] gap-4 items-start">
        {/* Left column: search + info */}
        <div>
          <div className="mb-4 rounded-xl border border-gray-100 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: "#E65100" }}
              />
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Buurtje
              </span>
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

          {/* Map shown below search on mobile only */}
          <div className="mb-4 md:hidden">
            <PostcodeMap postcode={data?.code ?? null} />
          </div>

          {isLoading && (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          )}

          {data && !isLoading && (
            <div className="space-y-4">
              <QuickStats data={data} />
              <Amenities data={data} />
              <Migration data={data} />
              <HousingTypes data={data} />
              <ElectionResults data={data} />
            </div>
          )}
        </div>

        {/* Right column: sticky map (desktop only) */}
        <div className="hidden md:block sticky top-4 self-start">
          <PostcodeMap postcode={data?.code ?? null} />
        </div>
      </div>
    </main>
  );
```

Key changes:
- `max-w-3xl` → `max-w-6xl`, `py-8` → `py-4`
- Two-column CSS grid: `grid-cols-1 md:grid-cols-[1fr,minmax(0,500px)]`
- `PostcodeMap` removed from the info section's `space-y-4`
- Mobile: map rendered between search card and info sections (`md:hidden`)
- Desktop: map in right column with `sticky top-4` (`hidden md:block`)
- `PostcodeMap` receives `data?.code ?? null` — shows NL view when no data
- `items-start` on the grid so the sticky column aligns to top

- [ ] **Step 2: Verify in browser — desktop**

Run: `npm run dev`
Open at desktop width (≥768px). Confirm:
- Two-column layout with search+info on left, map on right
- Map is sticky — scrolling the left column keeps the map in place
- Before search: map shows Netherlands, left has only search bar
- After search: map zooms to area, info sections appear on left

- [ ] **Step 3: Verify in browser — mobile**

Resize to mobile width (<768px). Confirm:
- Single-column layout
- Order: search bar → map → info sections
- Map is not sticky, scrolls with content

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: two-column layout with sticky map on desktop"
```

---

## Task 4: POI Toggle Buttons and Overpass Integration

**Files:**
- Modify: `src/components/PostcodeMap.tsx`

This task adds the school/supermarket toggle buttons and the Overpass API marker rendering to the map.

- [ ] **Step 1: Add POI state, toggle buttons, and Overpass fetching**

Replace the entire content of `src/components/PostcodeMap.tsx` with the final version:

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { fetchPOIs, type POI, type BBox } from "@/lib/overpass";

interface PostcodeMapProps {
  postcode: string | null;
}

const NL_CENTER: [number, number] = [52.2, 5.3];
const NL_ZOOM = 7;
const BBOX_PADDING = 0.005; // ~500m

export default function PostcodeMap({ postcode }: PostcodeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const schoolLayerRef = useRef<LayerGroup | null>(null);
  const shopLayerRef = useRef<LayerGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSchools, setShowSchools] = useState(false);
  const [showShops, setShowShops] = useState(false);
  const [poiError, setPoiError] = useState<string | null>(null);

  // Cache: postcode -> { schools, supermarkets }
  const poiCacheRef = useRef<
    Record<string, { schools?: POI[]; supermarkets?: POI[] }>
  >({});

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: window.innerWidth >= 768,
      });
      mapInstanceRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a> | Boundaries: &copy; CBS, &copy; ESRI Nederland',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      map.setView(NL_CENTER, NL_ZOOM);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update boundary when postcode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    let cancelled = false;

    // Reset POI state on postcode change
    setShowSchools(false);
    setShowShops(false);
    setPoiError(null);
    if (schoolLayerRef.current) {
      schoolLayerRef.current.remove();
      schoolLayerRef.current = null;
    }
    if (shopLayerRef.current) {
      shopLayerRef.current.remove();
      shopLayerRef.current = null;
    }

    async function updateBoundary() {
      const L = (await import("leaflet")).default;
      const topojson = await import("topojson-client");

      if (cancelled || !mapInstanceRef.current) return;

      // Remove old boundary
      if (boundaryLayerRef.current) {
        boundaryLayerRef.current.remove();
        boundaryLayerRef.current = null;
      }

      if (!postcode) {
        setError(null);
        mapInstanceRef.current.setView(NL_CENTER, NL_ZOOM);
        return;
      }

      const res = await fetch("/postcode4_2024.topojson");
      if (!res.ok) {
        setError("Could not load map data");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topo: any = await res.json();

      if (cancelled) return;

      const objectKey = Object.keys(topo.objects)[0];
      const geojson = topojson.feature(
        topo,
        topo.objects[objectKey]
      ) as unknown as GeoJSON.FeatureCollection;

      const pc = parseInt(postcode, 10);
      const feature = geojson.features.find(
        (f) => f.properties?.postcode === pc
      );

      if (!feature) {
        setError("Postcode area not found on map");
        return;
      }

      setError(null);

      const layer = L.geoJSON(feature, {
        style: {
          color: "#E65100",
          weight: 3,
          dashArray: "8, 6",
          fillColor: "#E65100",
          fillOpacity: 0.08,
          opacity: 0.9,
        },
      }).addTo(mapInstanceRef.current);

      boundaryLayerRef.current = layer;
      mapInstanceRef.current.fitBounds(layer.getBounds(), { padding: [30, 30] });

      // Pre-fetch POI data in background
      const bounds = layer.getBounds();
      const bbox: BBox = [
        bounds.getSouth() - BBOX_PADDING,
        bounds.getWest() - BBOX_PADDING,
        bounds.getNorth() + BBOX_PADDING,
        bounds.getEast() + BBOX_PADDING,
      ];

      if (!poiCacheRef.current[postcode]) {
        poiCacheRef.current[postcode] = {};
      }

      Promise.all([
        fetchPOIs("school", bbox).then((pois) => {
          poiCacheRef.current[postcode!] = {
            ...poiCacheRef.current[postcode!],
            schools: pois,
          };
        }),
        fetchPOIs("supermarket", bbox).then((pois) => {
          poiCacheRef.current[postcode!] = {
            ...poiCacheRef.current[postcode!],
            supermarkets: pois,
          };
        }),
      ]).catch(() => {
        // Errors handled when toggling
      });
    }

    updateBoundary();

    return () => {
      cancelled = true;
    };
  }, [postcode]);

  // Render/remove school markers when toggle changes
  const renderMarkers = useCallback(
    async (
      pois: POI[],
      color: string,
      emoji: string,
      layerRef: React.MutableRefObject<LayerGroup | null>
    ) => {
      const L = (await import("leaflet")).default;
      const map = mapInstanceRef.current;
      if (!map) return;

      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }

      const group = L.layerGroup();
      for (const poi of pois) {
        const icon = L.divIcon({
          html: `<span style="font-size:18px">${emoji}</span>`,
          className: "poi-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([poi.lat, poi.lon], { icon });
        if (poi.name) {
          marker.bindPopup(
            `<span style="font-size:13px;font-weight:500">${poi.name}</span>`
          );
        }
        group.addLayer(marker);
      }
      group.addTo(map);
      layerRef.current = group;
    },
    []
  );

  // Toggle schools
  useEffect(() => {
    if (!postcode || !mapInstanceRef.current) return;

    if (!showSchools) {
      if (schoolLayerRef.current) {
        schoolLayerRef.current.remove();
        schoolLayerRef.current = null;
      }
      return;
    }

    const cached = poiCacheRef.current[postcode]?.schools;
    if (cached) {
      renderMarkers(cached, "#1565C0", "🏫", schoolLayerRef);
    } else {
      // Data not cached yet — fetch now
      const bounds = boundaryLayerRef.current?.getBounds();
      if (!bounds) return;
      const bbox: BBox = [
        bounds.getSouth() - BBOX_PADDING,
        bounds.getWest() - BBOX_PADDING,
        bounds.getNorth() + BBOX_PADDING,
        bounds.getEast() + BBOX_PADDING,
      ];
      fetchPOIs("school", bbox)
        .then((pois) => {
          if (!poiCacheRef.current[postcode]) poiCacheRef.current[postcode] = {};
          poiCacheRef.current[postcode].schools = pois;
          renderMarkers(pois, "#1565C0", "🏫", schoolLayerRef);
        })
        .catch(() => setPoiError("Could not load schools"));
    }
  }, [showSchools, postcode, renderMarkers]);

  // Toggle supermarkets
  useEffect(() => {
    if (!postcode || !mapInstanceRef.current) return;

    if (!showShops) {
      if (shopLayerRef.current) {
        shopLayerRef.current.remove();
        shopLayerRef.current = null;
      }
      return;
    }

    const cached = poiCacheRef.current[postcode]?.supermarkets;
    if (cached) {
      renderMarkers(cached, "#2E7D32", "🛒", shopLayerRef);
    } else {
      const bounds = boundaryLayerRef.current?.getBounds();
      if (!bounds) return;
      const bbox: BBox = [
        bounds.getSouth() - BBOX_PADDING,
        bounds.getWest() - BBOX_PADDING,
        bounds.getNorth() + BBOX_PADDING,
        bounds.getEast() + BBOX_PADDING,
      ];
      fetchPOIs("supermarket", bbox)
        .then((pois) => {
          if (!poiCacheRef.current[postcode]) poiCacheRef.current[postcode] = {};
          poiCacheRef.current[postcode].supermarkets = pois;
          renderMarkers(pois, "#2E7D32", "🛒", shopLayerRef);
        })
        .catch(() => setPoiError("Could not load supermarkets"));
    }
  }, [showShops, postcode, renderMarkers]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden relative">
      {error && (
        <div className="absolute top-2 left-2 z-[1000] bg-white/90 rounded px-2 py-1">
          <p className="text-xs text-gray-400">{error}</p>
        </div>
      )}

      {/* POI toggle buttons — only visible after search */}
      {postcode && (
        <div className="absolute top-2 right-2 z-[1000] flex gap-1.5">
          <button
            onClick={() => setShowSchools((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
              showSchools
                ? "bg-[#E65100] text-white border-[#E65100]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            🏫 Schools
          </button>
          <button
            onClick={() => setShowShops((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
              showShops
                ? "bg-[#E65100] text-white border-[#E65100]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            🛒 Shops
          </button>
        </div>
      )}

      {/* POI error tooltip */}
      {poiError && (
        <div className="absolute top-10 right-2 z-[1000] bg-red-50 text-red-600 text-xs rounded px-2 py-1 border border-red-200">
          {poiError}
        </div>
      )}

      <div
        ref={mapRef}
        className="w-full h-[300px] md:h-[calc(100vh-2rem)]"
      />
    </div>
  );
}
```

- [ ] **Step 2: Add a CSS rule for the custom marker class**

In `src/app/globals.css`, add at the end:

```css
.poi-marker {
  background: none !important;
  border: none !important;
}
```

This removes Leaflet's default white-square background from `divIcon`.

- [ ] **Step 3: Verify in browser — full flow**

Run: `npm run dev`
Test the full flow:
1. Page loads → map shows Netherlands, no toggle buttons
2. Search for "1011" → map zooms to postcode area with dashed boundary, toggle buttons appear
3. Click "🏫 Schools" → button turns orange, school markers appear on map
4. Click "🛒 Shops" → button turns orange, supermarket markers appear
5. Click a marker → popup shows the name
6. Click active toggle again → markers disappear
7. Search for a new postcode → toggles reset to off, old markers gone

- [ ] **Step 4: Verify on mobile**

Resize to mobile width. Confirm:
- Toggle buttons are visible and functional
- Map height is 300px
- Scroll wheel zoom is disabled

- [ ] **Step 5: Commit**

```bash
git add src/components/PostcodeMap.tsx src/app/globals.css
git commit -m "feat: add school/supermarket POI toggles with Overpass API"
```

---

## Task 5: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run the test suite**

Run: `npx jest --no-cache`
Expected: All tests pass (including the new overpass tests)

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Full browser test — desktop**

Open at desktop width. Test:
1. Default state: NL map on right, search bar on left
2. Search "1011": left column fills with data, map zooms to Amsterdam postcode area
3. Scroll left column: map stays sticky on the right
4. Toggle schools on: markers appear with emoji icons
5. Toggle shops on: supermarket markers appear
6. Click a marker: popup with name
7. Toggle off: markers disappear
8. Search "3511": everything updates, toggles reset

- [ ] **Step 5: Full browser test — mobile**

Resize to mobile width. Test:
1. Single column layout
2. Search → map below search bar, info sections below map
3. Toggle buttons work on mobile map
4. Map scrolls with page (not sticky)

- [ ] **Step 6: Commit (if any adjustments were needed)**

```bash
git add -A
git commit -m "fix: address integration issues from final verification"
```

Only commit if changes were made during verification. Skip if everything passed cleanly.
