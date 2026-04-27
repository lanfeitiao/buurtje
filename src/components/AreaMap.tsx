"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import {
  addCartoTileLayer,
  fetchSchoolsInBbox,
  loadLeaflet,
  schoolIcon as makeSchoolIcon,
} from "@/lib/mapHelpers";

type AddressPoint = { lat: number; lon: number; label: string };

export type AreaMapContext =
  | { kind: "postcode"; code: string; addressPoint?: AddressPoint }
  | { kind: "buurt" | "wijk"; geometrieWkt: string; label: string;
      addressPoint?: AddressPoint };

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
      ? `postcode:${context.code}:${context.addressPoint?.lat ?? ""}:${context.addressPoint?.lon ?? ""}`
      : `${context.kind}:${context.geometrieWkt}:${context.addressPoint?.lat ?? ""}:${context.addressPoint?.lon ?? ""}`;

  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      const L = await loadLeaflet();

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
      } else {
        feature = wktToFeature(context.geometrieWkt);
      }

      if (!feature && !context.addressPoint) {
        setError(
          context.kind === "postcode"
            ? "Postcode area not found on map"
            : "Could not load boundary for this area"
        );
        return;
      }

      setError(null);

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });
      mapInstanceRef.current = map;

      addCartoTileLayer(L, map);

      if (feature) {
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
        map.fitBounds(layer.getBounds(), { padding: [30, 30] });
      } else if (context.addressPoint) {
        // No boundary — center on the address with a street-level zoom
        map.setView([context.addressPoint.lat, context.addressPoint.lon], 16);
      }

      if (context.addressPoint) {
        const addressIcon = L.divIcon({
          className: "area-map-pin area-map-pin--address",
          html: "📍",
          iconSize: [24, 24],
          iconAnchor: [12, 24],   // bottom of pin sits on the point
        });
        L.marker(
          [context.addressPoint.lat, context.addressPoint.lon],
          { icon: addressIcon }
        )
          .addTo(map)
          .bindPopup(context.addressPoint.label);
      }

      const schoolIcon = makeSchoolIcon(L);
      const shopIcon = L.divIcon({
        className: "area-map-pin area-map-pin--shop",
        html: "🛒",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const mapBounds = map.getBounds();

      // Schools: authoritative DUO data via our API
      try {
        const schools = await fetchSchoolsInBbox(mapBounds);
        if (!cancelled) {
          for (const s of schools) {
            const popup = s.denominatie
              ? `<strong>${s.name}</strong><br/><span style="color:#666">${s.denominatie}</span>`
              : `<strong>${s.name}</strong>`;
            L.marker([s.lat, s.lon], { icon: schoolIcon })
              .addTo(map)
              .bindPopup(popup);
          }
        }
      } catch {
        // Schools fetch is best-effort
      }

      // Supermarkets: Overpass (no authoritative Dutch dataset bundled)
      try {
        const bboxOp = `${mapBounds.getSouth()},${mapBounds.getWest()},${mapBounds.getNorth()},${mapBounds.getEast()}`;
        const q = `[out:json][timeout:15];(node["shop"="supermarket"](${bboxOp});way["shop"="supermarket"](${bboxOp}););out center tags;`;
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
          const name =
            el.tags?.name ??
            el.tags?.["name:nl"] ??
            el.tags?.brand ??
            el.tags?.operator ??
            "Supermarket";
          L.marker([lat, lon], { icon: shopIcon })
            .addTo(map)
            .bindPopup(name);
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
        {context.addressPoint && (
          <div className="flex items-center gap-1.5">
            <span>📍</span>
            <span className="text-gray-700">Your address</span>
          </div>
        )}
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
