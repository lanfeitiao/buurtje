import type { Map as LeafletMap, LatLngBounds } from "leaflet";

export type LeafletNS = typeof import("leaflet");

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a> | Boundaries: &copy; CBS, &copy; ESRI Nederland | Schools: &copy; <a href="https://duo.nl/open_onderwijsdata/">DUO</a> (CC-BY 4.0)';

export async function loadLeaflet(): Promise<LeafletNS> {
  const L = (await import("leaflet")).default;
  await import("leaflet/dist/leaflet.css");
  return L;
}

export function addCartoTileLayer(L: LeafletNS, map: LeafletMap) {
  L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);
}

export function schoolIcon(L: LeafletNS) {
  return L.divIcon({
    className: "area-map-pin area-map-pin--school",
    html: "🏫",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export type School = {
  name: string;
  lat: number;
  lon: number;
  denominatie?: string | null;
};

export async function fetchSchoolsInBbox(
  bounds: LatLngBounds
): Promise<School[]> {
  const bbox = [
    bounds.getSouth(),
    bounds.getWest(),
    bounds.getNorth(),
    bounds.getEast(),
  ].join(",");
  const res = await fetch(`/api/schools?bbox=${bbox}`);
  if (!res.ok) return [];
  const { schools } = (await res.json()) as { schools: School[] };
  return schools ?? [];
}
