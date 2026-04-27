/**
 * Scrape elementary-school data from allecijfers.nl per gemeente and write
 * one JSON file per gemeente to public/schools/. Each file contains a slim
 * record per school with full history of advies (VO-uitstroom) and
 * eindtoets scores.
 *
 * Cache: data/schools-allecijfers-cache.json keyed by detail URL. Re-runs
 * skip cached schools entirely. Delete the cache to force a re-scrape.
 *
 * Geocoding via PDOK Locatieserver, same shape as import-duo-schools.ts.
 *
 * Usage:
 *   npm run fetch-schools                         # the 4 default gemeenten
 *   npm run fetch-schools -- haarlemmermeer       # add a new one
 *   npm run fetch-schools -- amsterdam haarlem    # specific subset
 */

import fs from "fs";
import path from "path";
import pc from "picocolors";

const ALLECIJFERS = "https://allecijfers.nl";

// Display name shown in allecijfers' comparison blocks ("Gemeente Haarlem").
// Falls back to title-casing the slug for ad-hoc additions.
const GEMEENTE_DISPLAY_NAMES: Record<string, string> = {
  haarlem: "Haarlem",
  amsterdam: "Amsterdam",
  amstelveen: "Amstelveen",
  hilversum: "Hilversum",
};
const PDOK_URL =
  "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const OUT_DIR = path.join(process.cwd(), "public", "schools");
const CACHE_PATH = path.join(
  process.cwd(),
  "data",
  "schools-allecijfers-cache.json"
);
const REQUEST_DELAY_MS = 100;

const DEFAULT_GEMEENTEN = ["haarlem", "amsterdam", "amstelveen", "hilversum"];

type AdviesYear = {
  year: string;
  speciaal_praktijk: number | null;
  vmbo_b_k: number | null;
  vmbo_t: number | null;
  havo: number | null;
  vwo: number | null;
  overig: number | null;
};

type ScoreYear = {
  year: string;
  toets: string; // "IEP" | "Cito" | other
  score: number;
};

type LeerlingenYear = {
  year: string;
  count: number;
};

type School = {
  brin: string | null;
  vestigingsnummer: string | null;
  name: string;
  url: string;
  street: string | null;
  postcode: string | null;
  city: string | null;
  denominatie: string | null;
  buurt: string | null;
  buurtSlug: string | null;
  lat: number | null;
  lon: number | null;
  leerlingen: LeerlingenYear[];
  scores: ScoreYear[];
  advies: AdviesYear[];
};

type Cache = Record<string, School>;

type RegionScoreRow = { toets: string; year: string; score: number };
type RegionAdviesRow = {
  year: string;
  speciaal_praktijk: number;
  vmbo_b_k: number;
  vmbo_t: number;
  havo: number;
  vwo: number;
  overig: number;
};
// Region (gemeente or nederland) aggregate counts. Note that advies values
// are absolute leerling counts, not percentages — different unit from the
// per-school `advies` history (which is %). Consumers can derive % per row
// by summing the six categories.
type RegionAggregate = {
  advies: RegionAdviesRow[];
  scores: RegionScoreRow[];
};
type GemeenteAverages = {
  gemeente: { name: string } & RegionAggregate;
  nederland: RegionAggregate;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "buurtje-scraper/0.1 (+local)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

// --- Overview parsing -------------------------------------------------------

type OverviewEntry = { url: string; slug: string; name: string };

function parseOverview(html: string): OverviewEntry[] {
  // Allecijfers' overview lists every school attended by children from this
  // gemeente — including schools located just over the border. Per the
  // user's call we keep all of them; the gemeente bucket is just "what the
  // overview returned", not "located here".
  const seen = new Set<string>();
  const out: OverviewEntry[] = [];

  const tables = extractTables(html);
  for (const table of tables) {
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let r: RegExpExecArray | null;
    while ((r = rowRe.exec(table))) {
      const linkM = r[1].match(
        /<a[^>]+href=["']\/basisschool\/([^"'#?\/]+)\/?["'][^>]*>([^<]+)<\/a>/
      );
      if (!linkM) continue;
      const slug = linkM[1];
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({
        url: `${ALLECIJFERS}/basisschool/${slug}/`,
        slug,
        name: decodeEntities(linkM[2]).trim(),
      });
    }
  }
  return out;
}

// --- Detail parsing ---------------------------------------------------------

function parseName(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? stripTags(decodeEntities(m[1])) : "";
}

function parseBrin(html: string): { brin: string | null; vestigingsnummer: string | null } {
  // Format: "BRIN ... en vestigingsnummer:</strong> 16AR00."
  const m = html.match(/vestigingsnummer:\s*<\/strong>\s*([0-9A-Z]{4})([0-9]{2})/);
  return m ? { brin: m[1], vestigingsnummer: m[2] } : { brin: null, vestigingsnummer: null };
}

function parseAddress(html: string): {
  street: string | null;
  postcode: string | null;
  city: string | null;
} {
  // The address sits inside a <p> element:
  //   <strong>Adres: </strong>J.P. Coenstraat 41, <a href='/postcode/1215KN'>1215KN</a>, Hilversum.</p>
  // Earlier we stopped the segment at the first ".", which broke for any
  // street name containing a period ("J.P.", "Dr.", etc.). Anchor on the
  // closing </p> instead.
  const seg = html.match(/Adres:[\s\S]*?<\/p>/);
  if (!seg) return { street: null, postcode: null, city: null };
  const text = stripTags(decodeEntities(seg[0]));
  // stripTags can introduce stray whitespace around the postcode (e.g.
  // "</a>," becomes " ,"), so allow optional whitespace around the commas.
  const m = text.match(/Adres:\s*(.+?)\s*,\s*(\d{4}\s*[A-Z]{2})\s*,\s*([^.]+?)\s*\./);
  if (!m) return { street: null, postcode: null, city: null };
  return {
    street: m[1].trim(),
    postcode: m[2].replace(/\s+/g, ""),
    city: m[3].trim(),
  };
}

function parseDenominatie(html: string): string | null {
  // "Denominatie</?>: |Openbaar.|"
  const seg = html.match(/Denominatie[\s\S]{0,200}?\./);
  if (!seg) return null;
  const text = stripTags(decodeEntities(seg[0]));
  const m = text.match(/Denominatie\s*:\s*([^.]+)\./);
  return m ? m[1].trim() : null;
}

function parseBuurt(
  html: string,
  gemeenteSlug: string
): { buurt: string | null; buurtSlug: string | null } {
  // Link is the most reliable: <a href='/buurt/kleverpark-noord-haarlem/'>.
  const link = html.match(/href=["']\/buurt\/([^"'\/]+)\/?["']/);
  const buurtSlug = link ? link[1] : null;

  // Prose comes in two shapes:
  //   "ligt in de buurt Kleverpark-noord"   (separating word "buurt")
  //   "ligt in de Theaterbuurt"             (buurt name already contains "buurt")
  // Capture everything after "ligt in de" until a tag, then trim a leading "buurt ".
  let buurt: string | null = null;
  const prose = html.match(/ligt in de\s+([^<\n]+?)\s*<\/?/);
  if (prose) {
    let txt = prose[1].trim();
    if (/^buurt\s+/i.test(txt)) txt = txt.replace(/^buurt\s+/i, "");
    buurt = txt;
  } else if (buurtSlug) {
    // Fallback: derive a display name from the slug by stripping the gemeente
    // suffix and title-casing the rest.
    const suffix = `-${gemeenteSlug}`;
    const base = buurtSlug.endsWith(suffix)
      ? buurtSlug.slice(0, -suffix.length)
      : buurtSlug;
    buurt = base
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("-");
  }

  return { buurt, buurtSlug };
}

// --- Tables ----------------------------------------------------------------

function extractTables(html: string): string[] {
  const out: string[] = [];
  const re = /<table[^>]*>([\s\S]*?)<\/table>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function tableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g;
  let r: RegExpExecArray | null;
  while ((r = rowRe.exec(tableHtml))) {
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((c = cellRe.exec(r[1]))) {
      cells.push(stripTags(decodeEntities(c[1])));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseLeerlingenTable(table: string): LeerlingenYear[] {
  // Headers: Schooljaar | Aantal leerlingen <name> | % verschil
  const rows = tableRows(table);
  const out: LeerlingenYear[] = [];
  for (const row of rows.slice(1)) {
    if (row.length < 2) continue;
    const year = row[0];
    const count = parseInt(row[1].replace(/\D/g, ""), 10);
    if (/^\d{4}-\d{4}$/.test(year) && Number.isFinite(count)) {
      out.push({ year, count });
    }
  }
  return out;
}

function parseScoresTable(table: string): ScoreYear[] {
  // Headers: Type toets | Schooljaar | Gemiddelde score
  const rows = tableRows(table);
  const out: ScoreYear[] = [];
  for (const row of rows.slice(1)) {
    if (row.length < 3) continue;
    const toets = row[0].trim();
    const year = row[1].trim();
    const score = parseFloat(row[2].replace(",", "."));
    if (toets && /^\d{4}-\d{4}$/.test(year) && Number.isFinite(score)) {
      out.push({ toets, year, score });
    }
  }
  return out;
}

function findTableWithHeaders(tables: string[], required: string[]): string | null {
  for (const t of tables) {
    if (required.every((s) => t.includes(s))) return t;
  }
  return null;
}

// Fallback for schools whose detail page omits the scores <table> entirely
// (e.g. very small schools, single-toets schools — the data still lives in
// the JS chart `grafiek_toetsen`). Long-format chart shape:
//   [['Type toets','Schooljaar','Gemiddelde score','School / gemeente / Nederland'],
//    ['IEP','2024-2025',84.23,'School of Understanding'],
//    ['IEP','2023-2024',74.56,'School of Understanding'],
//    ['IEP','2024-2025',81.52,'Gemeente Amstelveen'],
//    ['IEP','2024-2025',77.84,'Nederland'], ...]
// Keep rows whose 4th column is *neither* "Nederland" nor "Gemeente …".
function parseScoresFromChart(html: string): ScoreYear[] {
  const re = /arrayToDataTable\s*\(\s*(\[[\s\S]*?\])\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!/Type toets/.test(raw) || !/School \/ gemeente \/ Nederland/.test(raw)) continue;
    const data = jsArrayToJson<(string | number)[][]>(raw);
    if (!data || data.length < 2) continue;
    const out: ScoreYear[] = [];
    for (const row of data.slice(1)) {
      if (row.length < 4) continue;
      const who = String(row[3]);
      if (who === "Nederland" || who.startsWith("Gemeente ")) continue;
      const toets = String(row[0]);
      const year = String(row[1]);
      const score = typeof row[2] === "number" ? row[2] : parseFloat(String(row[2]));
      if (!toets || !/^\d{4}-\d{4}$/.test(year) || !Number.isFinite(score)) continue;
      out.push({ toets, year, score });
    }
    return out;
  }
  return [];
}

// --- Region aggregates (gemeente + nederland) ------------------------------
//
// The per-school detail page only shows a 3-category (Praktisch/Theoretisch/
// Overig) gemeente comparison. The full 6-category history lives on the
// gemeente comparison page (/basisscholen/gemeente-<slug>/) — and the same
// shape is published for Nederland (/basisscholen/nederland/). One extra
// fetch per region lets us pull the full 6-cat history plus all toets-types
// of scores, for both gemeente and Nederland.

// Convert a JS array literal (single-quoted strings, trailing commas allowed)
// into JSON we can parse. Returns null if the conversion fails.
function jsArrayToJson<T>(raw: string): T | null {
  try {
    const json = raw
      .replace(/,\s*([\]}])/g, "$1")
      .replace(/'((?:[^'\\]|\\.)*)'/g, (_, s: string) => `"${s.replace(/"/g, '\\"')}"`);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function parseRegionAdviesHistory(html: string): RegionAdviesRow[] {
  // [['Schooljaar','Speciaal/praktijk','VMBO-B/K','VMBO-T','HAVO','VWO','Overig'],
  //  ['2024-2025', 67, 194, 300, 450, 741, 6], ...]
  const re = /arrayToDataTable\s*\(\s*(\[[\s\S]*?\])\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!/Speciaal\/praktijk/.test(raw) || !/VMBO-B\/K/.test(raw)) continue;
    const data = jsArrayToJson<(string | number)[][]>(raw);
    if (!data || data.length < 2) continue;
    const out: RegionAdviesRow[] = [];
    for (const row of data.slice(1)) {
      const year = String(row[0]);
      if (!/^\d{4}-\d{4}$/.test(year)) continue;
      const num = (i: number): number => {
        const v = row[i];
        if (typeof v === "number") return v;
        const n = parseFloat(String(v));
        return Number.isFinite(n) ? n : 0;
      };
      out.push({
        year,
        speciaal_praktijk: num(1),
        vmbo_b_k: num(2),
        vmbo_t: num(3),
        havo: num(4),
        vwo: num(5),
        overig: num(6),
      });
    }
    return out;
  }
  return [];
}

function parseRegionScoresHistory(html: string): RegionScoreRow[] {
  // [['Schooljaar','Type toets','Gemiddelde score', { role: 'style' }],
  //  ['2014-2015','Cito',534.46,'#feb24c'],
  //  ['2014-2015','IEP',84.58,'#d62728'], ...]
  const re = /arrayToDataTable\s*\(\s*(\[[\s\S]*?\])\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (
      !/Schooljaar/.test(raw) ||
      !/Type toets/.test(raw) ||
      !/Gemiddelde score/.test(raw)
    )
      continue;
    // Strip { role: '...' } object literals so jsArrayToJson can parse the rest.
    const cleaned = raw.replace(/\{[^{}]*\}/g, '"_"');
    const data = jsArrayToJson<(string | number)[][]>(cleaned);
    if (!data || data.length < 2) continue;
    const out: RegionScoreRow[] = [];
    for (const row of data.slice(1)) {
      const year = String(row[0]);
      const toets = String(row[1]);
      const score = typeof row[2] === "number" ? row[2] : parseFloat(String(row[2]));
      if (!/^\d{4}-\d{4}$/.test(year) || !toets || !Number.isFinite(score)) continue;
      out.push({ toets, year, score });
    }
    return out;
  }
  return [];
}

function parseRegionAggregate(html: string): RegionAggregate {
  return {
    advies: parseRegionAdviesHistory(html),
    scores: parseRegionScoresHistory(html),
  };
}

function parseAdviesHistory(html: string): AdviesYear[] {
  // Find the arrayToDataTable call whose first row is the schooljaar header
  // for the 6-category breakdown. There may be other arrayToDataTable calls
  // on the page (pie chart for current year, etc.) — pick the multi-year one.
  const re = /arrayToDataTable\s*\(\s*(\[[\s\S]*?\])\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!/Schooljaar/.test(raw) || !/Speciaal\/praktijk/.test(raw)) continue;
    // The block looks like:
    //   [['Schooljaar','Speciaal/praktijk','VMBO-B/K','VMBO-T','HAVO','VWO','Overig'],
    //    ['2024-2025', 0, 0, 12, 18, 67, 0], ...]
    // Convert single-quoted JS array literal into JSON, then parse.
    const json = raw
      // Remove trailing commas before ] or }
      .replace(/,\s*([\]}])/g, "$1")
      // Single-quoted strings → double-quoted
      .replace(/'((?:[^'\\]|\\.)*)'/g, (_, s: string) => `"${s.replace(/"/g, '\\"')}"`);
    let data: (string | number)[][];
    try {
      data = JSON.parse(json) as (string | number)[][];
    } catch {
      continue;
    }
    if (data.length < 2) continue;
    const header = data[0].map((x) => String(x));
    const idx = (k: string) => header.indexOf(k);
    const iSp = idx("Speciaal/praktijk");
    const iBk = idx("VMBO-B/K");
    const iVt = idx("VMBO-T");
    const iH = idx("HAVO");
    const iV = idx("VWO");
    const iOv = idx("Overig");
    const out: AdviesYear[] = [];
    for (const row of data.slice(1)) {
      const year = String(row[0]);
      if (!/^\d{4}-\d{4}$/.test(year)) continue;
      const num = (i: number): number | null => {
        if (i < 0) return null;
        const v = row[i];
        if (typeof v === "number") return v;
        const n = parseFloat(String(v));
        return Number.isFinite(n) ? n : null;
      };
      out.push({
        year,
        speciaal_praktijk: num(iSp),
        vmbo_b_k: num(iBk),
        vmbo_t: num(iVt),
        havo: num(iH),
        vwo: num(iV),
        overig: num(iOv),
      });
    }
    return out;
  }
  return [];
}

// --- PDOK geocoding ---------------------------------------------------------

async function geocode(
  postcode: string,
  street: string
): Promise<{ lat: number; lon: number } | null> {
  // Best query is "<postcode> <huisnummer>" — pull leading number from street.
  const huisnr = street.match(/\b(\d+)\b/)?.[1] ?? "";
  const q = `${postcode} ${huisnr}`.trim();
  const url = `${PDOK_URL}?q=${encodeURIComponent(q)}&fl=centroide_ll&rows=1&fq=type:adres`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { response?: { docs?: { centroide_ll?: string }[] } };
  const doc = json.response?.docs?.[0];
  if (!doc?.centroide_ll) return null;
  const m = doc.centroide_ll.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!m) return null;
  return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

// --- Cache ------------------------------------------------------------------

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

// --- Per-school orchestration ----------------------------------------------

function parseSchool(
  html: string,
  entry: OverviewEntry,
  gemeenteSlug: string
): School {
  const tables = extractTables(html);
  const { brin, vestigingsnummer } = parseBrin(html);
  const { street, postcode, city } = parseAddress(html);
  const denominatie = parseDenominatie(html);
  const { buurt, buurtSlug } = parseBuurt(html, gemeenteSlug);
  const leerlingen = tables[0] ? parseLeerlingenTable(tables[0]) : [];
  // Find the scores table by header content rather than positional index —
  // some schools omit it, in which case fall back to the JS chart.
  const scoresTable = findTableWithHeaders(tables, [
    "Type toets",
    "Schooljaar",
    "Gemiddelde score",
  ]);
  let scores = scoresTable ? parseScoresTable(scoresTable) : [];
  if (scores.length === 0) scores = parseScoresFromChart(html);
  const advies = parseAdviesHistory(html);

  return {
    brin,
    vestigingsnummer,
    name: parseName(html) || entry.name,
    url: entry.url,
    street,
    postcode,
    city,
    denominatie,
    buurt,
    buurtSlug,
    lat: null,
    lon: null,
    leerlingen,
    scores,
    advies,
  };
}

async function fetchAndParseSchool(
  entry: OverviewEntry,
  gemeenteSlug: string
): Promise<{ school: School; html: string }> {
  const html = await getHtml(entry.url);
  const school = parseSchool(html, entry, gemeenteSlug);
  if (school.postcode && school.street) {
    try {
      const coords = await geocode(school.postcode, school.street);
      if (coords) {
        school.lat = coords.lat;
        school.lon = coords.lon;
      }
    } catch {
      // best-effort
    }
  }
  return { school, html };
}

type IndexEntry = {
  slug: string;
  name: string;
  lat: number | null;
  lon: number | null;
  denominatie: string | null;
  buurt: string | null;
  buurtSlug: string | null;
  // Most recent year's stats, sliced from the per-school history arrays so
  // the table can render without loading every per-school file. Null when
  // the school has no data for that field.
  latestLeerlingen: number | null;
  latestScore: ScoreYear | null;
  latestAdvies: AdviesYear | null;
};

async function processGemeente(gemeente: string, cache: Cache): Promise<void> {
  console.log(`\n${pc.bold(pc.cyan(`■ ${gemeente}`))}`);
  const overviewUrl = `${ALLECIJFERS}/basisscholen-overzicht/${gemeente}/`;
  const overviewHtml = await getHtml(overviewUrl);
  const entries = parseOverview(overviewHtml);
  console.log(`  ${pc.dim(`${entries.length} schools on overview`)}`);

  const dir = path.join(OUT_DIR, gemeente);
  fs.mkdirSync(dir, { recursive: true });

  const index: IndexEntry[] = [];
  let lastHtml: string | null = null;
  let cached = 0;
  let fresh = 0;
  let failed = 0;
  const total = entries.length;
  const pad = String(total).length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const counter = pc.dim(`[${String(i + 1).padStart(pad)}/${total}]`);
    let school: School | undefined = cache[entry.url];
    if (school) {
      cached++;
      console.log(`  ${counter} ${pc.gray("CACHE")} ${entry.name}`);
    } else {
      const start = Date.now();
      try {
        const result = await fetchAndParseSchool(entry, gemeente);
        school = result.school;
        lastHtml = result.html;
        cache[entry.url] = school;
        fresh++;
        const ms = Date.now() - start;
        console.log(
          `  ${counter} ${pc.green("FETCH")} ${entry.name} ${pc.dim(`(${ms}ms)`)}`
        );
      } catch (err) {
        failed++;
        console.warn(
          `  ${counter} ${pc.red("FAIL ")} ${entry.name} ${pc.dim(String(err))}`
        );
      }
      if (fresh > 0 && fresh % 25 === 0) saveCache(cache);
      await sleep(REQUEST_DELAY_MS);
    }
    if (!school) continue;

    fs.writeFileSync(path.join(dir, `${entry.slug}.json`), JSON.stringify(school));
    index.push({
      slug: entry.slug,
      name: school.name,
      lat: school.lat,
      lon: school.lon,
      denominatie: school.denominatie,
      buurt: school.buurt,
      buurtSlug: school.buurtSlug,
      latestLeerlingen: school.leerlingen[0]?.count ?? null,
      latestScore: school.scores[0] ?? null,
      latestAdvies: school.advies[0] ?? null,
    });
  }
  saveCache(cache);
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index));

  void lastHtml; // no longer needed for averages

  // Gemeente + Nederland aggregates: fetched from /basisscholen/gemeente-<x>/
  // and /basisscholen/nederland/. Single fetch per gemeente plus one global
  // fetch per run (the Nederland page is fetched lazily and reused across
  // gemeenten — see fetchNederlandAggregate in main()).
  try {
    const gemeenteUrl = `${ALLECIJFERS}/basisscholen/gemeente-${gemeente}/`;
    console.log(`  ${pc.dim(`gemeente aggregates: ${gemeenteUrl}`)}`);
    const gemeenteHtml = await getHtml(gemeenteUrl);
    await sleep(REQUEST_DELAY_MS);
    const nederland = await getNederlandAggregate();
    const gemeenteName =
      GEMEENTE_DISPLAY_NAMES[gemeente] ??
      gemeente.charAt(0).toUpperCase() + gemeente.slice(1);
    const averages: GemeenteAverages = {
      gemeente: { name: gemeenteName, ...parseRegionAggregate(gemeenteHtml) },
      nederland,
    };
    fs.writeFileSync(path.join(dir, "averages.json"), JSON.stringify(averages));
    console.log(
      `  ${pc.dim(
        `averages: gemeente ${averages.gemeente.advies.length}y advies/${averages.gemeente.scores.length} scores · nederland ${nederland.advies.length}y advies/${nederland.scores.length} scores`
      )}`
    );
  } catch (err) {
    console.warn(
      `  ${pc.yellow("WARN")} could not build averages.json: ${String(err)}`
    );
  }

  console.log(
    `  ${pc.bold("done")}  ${pc.green(`${index.length} schools`)}` +
      `  ${pc.gray(`cached:${cached}`)} ${pc.green(`fresh:${fresh}`)}` +
      (failed ? ` ${pc.red(`failed:${failed}`)}` : "")
  );
}

// Fetched once per script run, reused across all gemeenten.
let nederlandAggregateMemo: RegionAggregate | null = null;
async function getNederlandAggregate(): Promise<RegionAggregate> {
  if (nederlandAggregateMemo) return nederlandAggregateMemo;
  const url = `${ALLECIJFERS}/basisscholen/nederland/`;
  console.log(`  ${pc.dim(`nederland aggregates: ${url}`)}`);
  const html = await getHtml(url);
  await sleep(REQUEST_DELAY_MS);
  nederlandAggregateMemo = parseRegionAggregate(html);
  return nederlandAggregateMemo;
}

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  const gemeenten = args.length ? args.map((a) => a.toLowerCase()) : DEFAULT_GEMEENTEN;
  const cache = loadCache();
  for (const g of gemeenten) {
    await processGemeente(g, cache);
  }
  console.log(`\n${pc.bold(pc.green("Done."))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
