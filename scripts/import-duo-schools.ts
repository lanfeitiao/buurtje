/**
 * Download DUO "Hoofdvestigingen basisonderwijs" CSV, geocode each school via
 * PDOK Locatieserver, and emit SQL INSERTs for the `schools` table in D1.
 *
 * Output: schools.sql (at repo root, matching election-data.sql convention).
 * Cache: data/schools-geocode-cache.json — re-runs skip already-geocoded rows.
 *
 * Usage: npx tsx scripts/import-duo-schools.ts
 */

import fs from "fs";
import path from "path";

const DUO_URL =
  "https://onderwijsdata.duo.nl/dataset/786f12ea-6224-42fd-ab72-de4d7d879535/resource/9801fdea-01bc-43cc-8e4e-3e03a2bbbbf8/download/instellingenbo.csv";
const PDOK_URL =
  "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const OUTPUT_SQL = path.join(process.cwd(), "schools.sql");
const CACHE_PATH = path.join(process.cwd(), "data", "schools-geocode-cache.json");
const REQUEST_DELAY_MS = 100;

type CachedGeocode = { lat: number; lon: number };
type Cache = Record<string, CachedGeocode | null>;

type Row = {
  brin: string;
  name: string;
  street: string;
  huisnummer: string;
  postcode: string;
  city: string;
  denominatie: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function downloadCsv(): Promise<string> {
  console.log(`Downloading ${DUO_URL}`);
  const res = await fetch(DUO_URL);
  if (!res.ok) throw new Error(`DUO download failed: ${res.status}`);
  return await res.text();
}

function parseRows(csv: string): Row[] {
  const lines = csv.split(/\r?\n/);
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const iBrin = col("INSTELLINGSCODE");
  const iName = col("INSTELLINGSNAAM");
  const iStreet = col("STRAATNAAM");
  const iHuis = col("HUISNUMMER-TOEVOEGING");
  const iPostcode = col("POSTCODE");
  const iCity = col("PLAATSNAAM");
  const iDenom = col("DENOMINATIE");

  const missing = [
    ["INSTELLINGSCODE", iBrin],
    ["INSTELLINGSNAAM", iName],
    ["STRAATNAAM", iStreet],
    ["HUISNUMMER-TOEVOEGING", iHuis],
    ["POSTCODE", iPostcode],
    ["PLAATSNAAM", iCity],
  ].filter(([, idx]) => (idx as number) < 0);
  if (missing.length) {
    throw new Error(`DUO CSV missing columns: ${missing.map((m) => m[0]).join(", ")}`);
  }

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = parseCsvLine(line);
    if (parts.length < header.length) continue;
    const brin = parts[iBrin].trim();
    const name = parts[iName].trim();
    const postcode = parts[iPostcode].replace(/\s+/g, "").toUpperCase();
    if (!brin || !name || !postcode) continue;
    rows.push({
      brin,
      name,
      street: parts[iStreet].trim(),
      huisnummer: parts[iHuis].trim(),
      postcode,
      city: parts[iCity].trim(),
      denominatie: iDenom >= 0 ? parts[iDenom].trim() : "",
    });
  }
  return rows;
}

type PdokDoc = { centroide_ll?: string };

async function geocode(row: Row): Promise<CachedGeocode | null> {
  const huisnummer = row.huisnummer.split(/\s+/)[0];
  const q = `${row.postcode} ${huisnummer}`.trim();
  const url = `${PDOK_URL}?q=${encodeURIComponent(q)}&fl=centroide_ll&rows=1&fq=type:adres`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { response?: { docs?: PdokDoc[] } };
  const doc = json.response?.docs?.[0];
  if (!doc?.centroide_ll) return null;
  const match = doc.centroide_ll.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return null;
  return { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
}

function loadCache(): Cache {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function writeSql(rows: (Row & CachedGeocode)[]) {
  const lines: string[] = [];
  lines.push("DELETE FROM schools;");

  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values = batch
      .map(
        (r) =>
          `('${sqlEscape(r.brin)}', '${sqlEscape(r.name)}', '${sqlEscape(
            r.street
          )}', '${sqlEscape(r.huisnummer)}', '${sqlEscape(
            r.postcode
          )}', '${sqlEscape(r.city)}', '${sqlEscape(r.denominatie)}', ${r.lat}, ${r.lon})`
      )
      .join(", ");
    lines.push(
      `INSERT INTO schools (brin, name, street, huisnummer, postcode, city, denominatie, lat, lon) VALUES ${values};`
    );
  }
  fs.writeFileSync(OUTPUT_SQL, lines.join("\n") + "\n");
}

async function main() {
  const csv = await downloadCsv();
  const rows = parseRows(csv);
  console.log(`Parsed ${rows.length} schools from DUO`);

  const cache = loadCache();
  const geocoded: (Row & CachedGeocode)[] = [];
  let hits = 0;
  let misses = 0;
  let failures = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cached = cache[row.brin];
    if (cached !== undefined) {
      if (cached !== null) {
        geocoded.push({ ...row, ...cached });
        hits++;
      } else {
        failures++;
      }
      continue;
    }

    try {
      const coords = await geocode(row);
      cache[row.brin] = coords;
      if (coords) {
        geocoded.push({ ...row, ...coords });
        misses++;
      } else {
        failures++;
      }
    } catch (err) {
      cache[row.brin] = null;
      failures++;
      console.warn(`Geocode failed for ${row.brin}: ${String(err)}`);
    }

    if ((i + 1) % 200 === 0) {
      saveCache(cache);
      console.log(
        `  ${i + 1}/${rows.length} (cache hits: ${hits}, fresh: ${misses}, failures: ${failures})`
      );
    }
    await sleep(REQUEST_DELAY_MS);
  }

  saveCache(cache);
  writeSql(geocoded);

  console.log(`\nDone.`);
  console.log(`  ${geocoded.length} schools geocoded → ${OUTPUT_SQL}`);
  console.log(`  cache hits: ${hits}, fresh geocodes: ${misses}, failures: ${failures}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
