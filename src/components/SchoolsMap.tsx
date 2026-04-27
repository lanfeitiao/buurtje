"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import {
  addCartoTileLayer,
  fetchSchoolsInBbox,
  loadLeaflet,
  schoolIcon as makeSchoolIcon,
} from "@/lib/mapHelpers";

interface SchoolsMapProps {
  gemeenteSlug: string;
}

export default function SchoolsMap({ gemeenteSlug }: SchoolsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    async function init() {
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      let geojson: GeoJSON.FeatureCollection;
      try {
        const res = await fetch(`/buurten/${gemeenteSlug}.json`);
        if (!res.ok) {
          setError("Could not load gemeente boundaries");
          return;
        }
        geojson = (await res.json()) as GeoJSON.FeatureCollection;
      } catch {
        setError("Could not load gemeente boundaries");
        return;
      }
      if (cancelled || !mapRef.current) return;

      setError(null);

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });
      mapInstanceRef.current = map;
      addCartoTileLayer(L, map);

      const layer = L.geoJSON(geojson, {
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

      const icon = makeSchoolIcon(L);
      try {
        const schools = await fetchSchoolsInBbox(map.getBounds());
        if (cancelled) return;
        for (const s of schools) {
          const popup = s.denominatie
            ? `<strong>${s.name}</strong><br/><span style="color:#666">${s.denominatie}</span>`
            : `<strong>${s.name}</strong>`;
          L.marker([s.lat, s.lon], { icon }).addTo(map).bindPopup(popup);
        }
      } catch {
        // Schools fetch is best-effort
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
  }, [gemeenteSlug]);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-5">
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

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
