"use client";

import { useEffect, useRef } from "react";
import type {
  GeoJSON as LeafletGeoJSON,
  Map as LeafletMap,
  Path,
} from "leaflet";
import {
  addCartoTileLayer,
  buurtKey,
  loadLeaflet,
  schoolIcon as makeSchoolIcon,
  schoolIconLow as makeSchoolIconLow,
} from "@/lib/mapHelpers";
import type { SchoolIndexEntry } from "@/lib/types";

interface SchoolsMapProps {
  buurten: GeoJSON.FeatureCollection | null;
  schools: SchoolIndexEntry[] | null;
  selectedBuurtKeys: Set<string>;
  onBuurtToggle: (key: string) => void;
  // Schools to render with the muted icon variant (no score, below gemeente
  // avg, or filtered out by the denominatie picker).
  mutedSlugs: Set<string>;
}

const STYLE_DEFAULT = {
  color: "#E65100",
  weight: 1.5,
  fillColor: "#E65100",
  fillOpacity: 0.06,
  opacity: 0.7,
};

const STYLE_SELECTED = {
  color: "#E65100",
  weight: 2.5,
  fillColor: "#E65100",
  fillOpacity: 0.25,
  opacity: 0.95,
};

export default function SchoolsMap({
  buurten,
  schools,
  selectedBuurtKeys,
  onBuurtToggle,
  mutedSlugs,
}: SchoolsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const buurtenLayerRef = useRef<LeafletGeoJSON | null>(null);

  // Stable callback ref so the click handler attached during init can call
  // the latest `onBuurtToggle` without re-attaching on every render.
  const onBuurtToggleRef = useRef(onBuurtToggle);
  useEffect(() => {
    onBuurtToggleRef.current = onBuurtToggle;
  }, [onBuurtToggle]);

  // Init map + polygons + markers. Re-runs only when the underlying data
  // changes (gemeente switch), not on selection changes.
  useEffect(() => {
    if (!mapRef.current || !buurten) return;
    let cancelled = false;

    async function init() {
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current || !buurten) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        buurtenLayerRef.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });
      mapInstanceRef.current = map;
      addCartoTileLayer(L, map);

      const layer = L.geoJSON(buurten, {
        style: STYLE_DEFAULT,
        onEachFeature: (feature, lyr) => {
          const name = feature.properties?.buurtnaam;
          if (!name) return;
          lyr.on("click", () => {
            onBuurtToggleRef.current(buurtKey(name));
          });
        },
      }).addTo(map);
      buurtenLayerRef.current = layer;
      map.fitBounds(layer.getBounds(), { padding: [20, 20] });

      if (schools) {
        const iconDefault = makeSchoolIcon(L);
        const iconLow = makeSchoolIconLow(L);
        for (const s of schools) {
          if (s.lat == null || s.lon == null) continue;
          const denom = s.denominatie
            ? `<br/><span style="color:#666">${s.denominatie}</span>`
            : "";
          const buurt = s.buurt
            ? `<br/><span style="color:#999;font-size:0.85em">${s.buurt}</span>`
            : "";
          const icon = mutedSlugs.has(s.slug) ? iconLow : iconDefault;
          // Link the school name in the popup to its allecijfers detail page.
          // Inline styles because the popup HTML lives outside the React tree
          // (Leaflet renders it raw), so Tailwind classes wouldn't apply.
          const nameLink =
            `<a href="https://allecijfers.nl/basisschool/${s.slug}/" ` +
            `target="_blank" rel="noopener noreferrer" ` +
            `style="color:#E65100;font-weight:600;text-decoration:underline;">` +
            `${s.name}</a>`;
          L.marker([s.lat, s.lon], { icon })
            .addTo(map)
            .bindPopup(`${nameLink}${denom}${buurt}`);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        buurtenLayerRef.current = null;
      }
    };
  }, [buurten, schools, mutedSlugs]);

  // Re-style polygons when the selection changes — without rebuilding the map.
  useEffect(() => {
    const layer = buurtenLayerRef.current;
    if (!layer) return;
    layer.eachLayer((lyr) => {
      const feature = (lyr as unknown as { feature?: GeoJSON.Feature }).feature;
      const name = feature?.properties?.buurtnaam;
      const selected = name ? selectedBuurtKeys.has(buurtKey(name)) : false;
      (lyr as Path).setStyle(selected ? STYLE_SELECTED : STYLE_DEFAULT);
    });
  }, [selectedBuurtKeys]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div ref={mapRef} style={{ height: 600, width: "100%" }} />
      <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1.5 text-xs shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center gap-1.5">
          <span>🏫</span>
          <span className="text-gray-700">School</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="area-map-pin area-map-pin--school area-map-pin--school-low inline-block leading-none">
            🏫
          </span>
          <span className="text-gray-700">Muted (no score / below avg / filtered)</span>
        </div>
      </div>
    </div>
  );
}
