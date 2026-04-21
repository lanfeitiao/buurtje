"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

interface PostcodeMapProps {
  postcode: string;
}

export default function PostcodeMap({ postcode }: PostcodeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      // Dynamic imports to avoid SSR issues
      const L = (await import("leaflet")).default;
      const topojson = await import("topojson-client");

      // Import Leaflet CSS
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !mapRef.current) return;

      // Clean up existing map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Fetch TopoJSON
      const res = await fetch("/postcode4_2024.topojson");
      if (!res.ok) {
        setError("Could not load map data");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topo: any = await res.json();

      if (cancelled) return;

      // Convert to GeoJSON
      const objectKey = Object.keys(topo.objects)[0];
      const geojson = topojson.feature(
        topo,
        topo.objects[objectKey]
      ) as unknown as GeoJSON.FeatureCollection;

      // Find the matching postcode feature
      const pc = parseInt(postcode, 10);
      const feature = geojson.features.find(
        (f) => f.properties?.postcode === pc
      );

      if (!feature) {
        setError("Postcode area not found on map");
        return;
      }

      setError(null);

      // Create map
      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      });
      mapInstanceRef.current = map;

      // Add tile layer (CartoDB Positron - clean, light style)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a> | Boundaries: &copy; CBS, &copy; ESRI Nederland',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      // Add the postcode boundary with dashed line
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

      // Fit map to the boundary
      map.fitBounds(layer.getBounds(), { padding: [30, 30] });
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [postcode]);

  if (error) {
    return (
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div ref={mapRef} style={{ height: 300, width: "100%" }} />
    </div>
  );
}
