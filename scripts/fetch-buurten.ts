/**
 * Fetch buurt (neighborhood) polygons from PDOK's CBS Wijken-en-Buurten 2024
 * OGC API and write one slim GeoJSON file per gemeente to public/buurten/.
 *
 * The OGC endpoint accepts `gemeentenaam` as a query param and returns all
 * buurten in that gemeente in a single page (largest target — Amsterdam — is
 * ~520 features, well under the limit). We strip the ~240 statistical
 * attributes down to the 5 identifiers we need and round coordinates to
 * 6 decimal places (~11 cm) to keep file sizes small.
 *
 * Usage:
 *   npm run fetch-buurten                          # the 4 default gemeenten
 *   npm run fetch-buurten -- haarlemmermeer        # add a new one
 *   npm run fetch-buurten -- amsterdam haarlem     # specific subset
 */

import fs from "fs";
import path from "path";

const PDOK_URL =
  "https://api.pdok.nl/cbs/wijken-en-buurten-2024/ogc/v1/collections/buurten/items";
const OUTPUT_DIR = path.join(process.cwd(), "public", "buurten");
const COORD_PRECISION = 6;

const DEFAULT_GEMEENTEN = ["Haarlem", "Amsterdam", "Amstelveen", "Hilversum"];

const KEEP_PROPERTIES = [
  "buurtcode",
  "buurtnaam",
  "wijkcode",
  "gemeentecode",
  "gemeentenaam",
] as const;

type Feature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
  links?: { rel: string; href: string }[];
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function roundCoords(coords: unknown): unknown {
  if (typeof coords === "number") {
    return Number(coords.toFixed(COORD_PRECISION));
  }
  if (Array.isArray(coords)) {
    return coords.map(roundCoords);
  }
  return coords;
}

function slimFeature(f: Feature): Feature {
  const properties: Record<string, unknown> = {};
  for (const key of KEEP_PROPERTIES) {
    if (key in f.properties) properties[key] = f.properties[key];
  }
  return {
    type: "Feature",
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates),
    },
    properties,
  };
}

async function fetchGemeente(name: string): Promise<FeatureCollection> {
  const url = new URL(PDOK_URL);
  url.searchParams.set("gemeentenaam", name);
  url.searchParams.set("crs", "http://www.opengis.net/def/crs/OGC/1.3/CRS84");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("f", "json");

  const res = await fetch(url, { headers: { Accept: "application/geo+json" } });
  if (!res.ok) {
    throw new Error(`PDOK request failed for ${name}: ${res.status} ${res.statusText}`);
  }
  const fc = (await res.json()) as FeatureCollection;
  if (!fc.features) {
    throw new Error(`PDOK response for ${name} has no features array`);
  }
  if (fc.links?.some((l) => l.rel === "next")) {
    throw new Error(
      `Pagination needed for ${name} but not implemented — bump limit or add page handling`
    );
  }
  return fc;
}

async function processGemeente(name: string): Promise<void> {
  console.log(`Fetching ${name}…`);
  const fc = await fetchGemeente(name);
  const slim: FeatureCollection = {
    type: "FeatureCollection",
    features: fc.features.map(slimFeature),
  };
  const slug = slugify(name);
  const outPath = path.join(OUTPUT_DIR, `${slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(slim));
  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`  ${slim.features.length} buurten → ${outPath} (${sizeKb} KB)`);
}

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  const gemeenten = args.length ? args : DEFAULT_GEMEENTEN;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const name of gemeenten) {
    await processGemeente(name);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
