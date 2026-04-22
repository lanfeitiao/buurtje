"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

export type AreaMapContext =
  | { kind: "postcode"; code: string }
  | { kind: "buurt" | "wijk"; geometrieWkt: string; label: string };

interface AreaMapProps {
  context: AreaMapContext;
}

function splitAtDepthZero(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim());
}

function stripOuterParens(s: string): string {
  const t = s.trim();
  return t.slice(t.indexOf("(") + 1, t.lastIndexOf(")"));
}

function parseRing(body: string): GeoJSON.Position[] {
  return body.split(",").map((pair) => {
    const [lon, lat] = pair.trim().split(/\s+/).map(Number);
    return [lon, lat];
  });
}

function wktToFeature(wkt: string): GeoJSON.Feature | null {
  if (!wkt) return null;
  const upper = wkt.trim().toUpperCase();
  try {
    if (upper.startsWith("POLYGON")) {
      const body = stripOuterParens(wkt);
      const rings = splitAtDepthZero(body).map((r) => parseRing(stripOuterParens(r)));
      return {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: rings },
      };
    }
    if (upper.startsWith("MULTIPOLYGON")) {
      const body = stripOuterParens(wkt);
      const polys = splitAtDepthZero(body).map((p) =>
        splitAtDepthZero(stripOuterParens(p)).map((r) => parseRing(stripOuterParens(r)))
      );
      return {
        type: "Feature",
        properties: {},
        geometry: { type: "MultiPolygon", coordinates: polys },
      };
    }
  } catch {
    return null;
  }
  return null;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export default function AreaMap({ context }: AreaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctxKey =
    context.kind === "postcode"
      ? `postcode:${context.code}`
      : `${context.kind}:${context.geometrieWkt}`;

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

      let feature: GeoJSON.Feature | null = null;

      if (context.kind === "postcode") {
        const topojson = await import("topojson-client");
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
        const pc = parseInt(context.code, 10);
        feature =
          geojson.features.find((f) => f.properties?.postcode === pc) ?? null;
        if (!feature) {
          setError("Postcode area not found on map");
          return;
        }
      } else {
        feature = wktToFeature(context.geometrieWkt);
        if (!feature) {
          setError("Could not load boundary for this area");
          return;
        }
      }

      setError(null);

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
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

      const layer = L.geoJSON(feature, {
        style: {
          color: "#E65100",
          weight: 3,
          dashArray: "8, 6",
          fillColor: "#E65100",
          fillOpacity: 0.08,
          opacity: 0.9,
        },
      }).addTo(map);

      const bounds = layer.getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });

      try {
        const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
        const q = `[out:json][timeout:15];(node["amenity"="school"](${bbox});node["shop"="supermarket"](${bbox});way["amenity"="school"](${bbox});way["shop"="supermarket"](${bbox}););out center tags;`;
        const res = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: new URLSearchParams({ data: q }),
        });
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as { elements: OverpassElement[] };
        if (cancelled) return;

        for (const el of json.elements) {
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (lat == null || lon == null) continue;
          const isSchool = el.tags?.amenity === "school";
          const emoji = isSchool ? "🏫" : "🛒";
          const fallback = isSchool ? "School" : "Supermarket";
          const icon = L.divIcon({
            className: `area-map-pin area-map-pin--${isSchool ? "school" : "shop"}`,
            html: emoji,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          L.marker([lat, lon], { icon })
            .addTo(map)
            .bindPopup(el.tags?.name ?? fallback);
        }
      } catch {
        // Overpass is best-effort; ignore failures
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxKey]);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div ref={mapRef} style={{ height: 520, width: "100%" }} />
      <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1.5 text-xs shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center gap-1.5">
          <span>🏫</span>
          <span className="text-gray-700">School</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>🛒</span>
          <span className="text-gray-700">Supermarket</span>
        </div>
      </div>
    </div>
  );
}
