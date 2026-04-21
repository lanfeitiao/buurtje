/**
 * Build a mapping from 6-digit postcode to buurt/wijk code via PDOK.
 * Caches to data/pc6-mapping.json so repeated runs only fetch missing entries.
 *
 * Usage: npx tsx scripts/build-pc6-mapping.ts <csv-path>
 */

import fs from "fs";

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error("Usage: npx tsx scripts/build-pc6-mapping.ts <csv-path>");
  process.exit(1);
}

const cachePath = "data/pc6-mapping.json";
fs.mkdirSync("data", { recursive: true });

interface Pc6Mapping {
  buurtcode: string;
  buurtnaam: string;
  wijkcode: string;
  wijknaam: string;
}

let cache: Record<string, Pc6Mapping | null> = {};
if (fs.existsSync(cachePath)) {
  cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  console.log(`Loaded ${Object.keys(cache).length} cached mappings`);
}

// Collect unique 6-digit postcodes from the CSV
const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.split("\n");
const postcodes = new Set<string>();
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(";").map((s) => s.replace(/^"|"$/g, "").trim());
  const pc = parts[2];
  if (pc && pc.length >= 4) postcodes.add(pc);
}

const todo = [...postcodes].filter((pc) => !(pc in cache));
console.log(`${postcodes.size} unique postcodes, ${todo.length} need lookup`);

async function lookup(pc: string): Promise<Pc6Mapping | null> {
  const params = new URLSearchParams({
    q: pc,
    fq: "type:adres",
    rows: "1",
    fl: "buurtcode,buurtnaam,wijkcode,wijknaam",
  });
  const res = await fetch(
    `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${params}`
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    response?: { docs?: Pc6Mapping[] };
  };
  const doc = json.response?.docs?.[0];
  if (!doc?.buurtcode) return null;
  return {
    buurtcode: doc.buurtcode,
    buurtnaam: doc.buurtnaam,
    wijkcode: doc.wijkcode,
    wijknaam: doc.wijknaam,
  };
}

let done = 0;
const start = Date.now();

// Process with concurrency
const CONCURRENCY = 10;
let queueIndex = 0;

async function worker() {
  while (queueIndex < todo.length) {
    const i = queueIndex++;
    const pc = todo[i];
    try {
      cache[pc] = await lookup(pc);
    } catch {
      cache[pc] = null;
    }
    done++;
    if (done % 100 === 0) {
      const elapsed = (Date.now() - start) / 1000;
      const rate = done / elapsed;
      const eta = Math.round((todo.length - done) / rate);
      console.log(
        `${done}/${todo.length} (${rate.toFixed(1)}/sec, ETA ${eta}s)`
      );
      // Save progress periodically
      fs.writeFileSync(cachePath, JSON.stringify(cache));
    }
  }
}

async function main() {
  await Promise.all(Array(CONCURRENCY).fill(null).map(() => worker()));

  fs.writeFileSync(cachePath, JSON.stringify(cache));

  const matched = Object.values(cache).filter((v) => v !== null).length;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
  console.log(`  Total: ${Object.keys(cache).length}`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Failed: ${Object.keys(cache).length - matched}`);
}

main();
