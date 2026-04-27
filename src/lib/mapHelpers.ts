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

// Lowercase + dash-collapse identifier used to match a buurt polygon (CBS
// `buurtnaam`) against a school's buurt (allecijfers display name). The two
// sources mostly agree on names, with one consistent abbreviation gap: CBS
// writes "X e.o." (Dutch for "en omgeving" — and surroundings) while
// allecijfers writes the phrase out in full. Normalize to the long form
// before slugifying so e.g. "Postjeskade e.o." and "Postjeskade en
// omgeving" both yield "postjeskade-en-omgeving".
export function buurtKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\be\.?\s*o\.?\b/g, "en omgeving")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
