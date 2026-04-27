"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import {
  addCartoTileLayer,
  loadLeaflet,
  schoolIcon as makeSchoolIcon,
} from "@/lib/mapHelpers";
import type { SchoolIndexEntry } from "@/lib/types";

interface SchoolsMapProps {
  buurten: GeoJSON.FeatureCollection | null;
  schools: SchoolIndexEntry[] | null;
}

export default function SchoolsMap({ buurten, schools }: SchoolsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!mapRef.current || !buurten) return;
    let cancelled = false;

    async function init() {
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current || !buurten) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });
      mapInstanceRef.current = map;
      addCartoTileLayer(L, map);

      const layer = L.geoJSON(buurten, {
        style: {
          color: "#E65100",
          weight: 1.5,
          fillColor: "#E65100",
          fillOpacity: 0.06,
          opacity: 0.7,
        },
        onEachFeature: (feature, lyr) => {
          const name = feature.properties?.buurtnaam;
          if (name) lyr.bindPopup(`<strong>${name}</strong>`);
        },
      }).addTo(map);
      map.fitBounds(layer.getBounds(), { padding: [20, 20] });

      if (schools) {
        const icon = makeSchoolIcon(L);
        for (const s of schools) {
          if (s.lat == null || s.lon == null) continue;
          const denom = s.denominatie
            ? `<br/><span style="color:#666">${s.denominatie}</span>`
            : "";
          const buurt = s.buurt
            ? `<br/><span style="color:#999;font-size:0.85em">${s.buurt}</span>`
            : "";
          L.marker([s.lat, s.lon], { icon })
            .addTo(map)
            .bindPopup(`<strong>${s.name}</strong>${denom}${buurt}`);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [buurten, schools]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div ref={mapRef} style={{ height: 600, width: "100%" }} />
      <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1.5 text-xs shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center gap-1.5">
          <span>🏫</span>
          <span className="text-gray-700">School</span>
        </div>
      </div>
    </div>
  );
}
