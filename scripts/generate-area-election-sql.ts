/**
 * Aggregate TK2025 election results by buurt_code and wijk_code,
 * using the PC6→buurt mapping from data/pc6-mapping.json.
 *
 * Outputs SQL for D1 import.
 *
 * Usage: npx tsx scripts/generate-area-election-sql.ts <csv-path> <output-sql-path>
 */

import fs from "fs";

const csvPath = process.argv[2];
const outputPath = process.argv[3] || "area-election-data.sql";

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error(
    "Usage: npx tsx scripts/generate-area-election-sql.ts <csv-path> [output-sql-path]"
  );
  process.exit(1);
}

interface Pc6Mapping {
  buurtcode: string;
  buurtnaam: string;
  wijkcode: string;
  wijknaam: string;
}
const mapping: Record<string, Pc6Mapping | null> = JSON.parse(
  fs.readFileSync("data/pc6-mapping.json", "utf-8")
);

console.log(`Loaded ${Object.keys(mapping).length} PC6→buurt mappings`);

// Aggregate by buurt and wijk
const byBuurt: Record<string, Record<string, number>> = {};
const byWijk: Record<string, Record<string, number>> = {};
let skippedNoMapping = 0;
let processed = 0;

const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.split("\n");

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(";").map((s) => s.replace(/^"|"$/g, ""));
  const pc6 = parts[2];
  const party = parts[5];
  const votes = parseInt(parts[6], 10);

  if (!pc6 || !party || isNaN(votes)) continue;
  const m = mapping[pc6];
  if (!m) {
    skippedNoMapping++;
    continue;
  }

  if (!byBuurt[m.buurtcode]) byBuurt[m.buurtcode] = {};
  byBuurt[m.buurtcode][party] = (byBuurt[m.buurtcode][party] || 0) + votes;

  if (!byWijk[m.wijkcode]) byWijk[m.wijkcode] = {};
  byWijk[m.wijkcode][party] = (byWijk[m.wijkcode][party] || 0) + votes;

  processed++;
}

// Generate SQL
const sqlLines: string[] = [];
sqlLines.push(
  `CREATE TABLE IF NOT EXISTS area_election_data (
  area_code TEXT NOT NULL,
  party TEXT NOT NULL,
  votes INTEGER NOT NULL,
  PRIMARY KEY (area_code, party)
);`
);
sqlLines.push("DELETE FROM area_election_data;");

const allAreas = { ...byBuurt, ...byWijk };
let batch: string[] = [];
for (const [areaCode, parties] of Object.entries(allAreas)) {
  for (const [party, votes] of Object.entries(parties)) {
    const escapedParty = party.replace(/'/g, "''");
    batch.push(`('${areaCode}', '${escapedParty}', ${votes})`);
    if (batch.length >= 50) {
      sqlLines.push(
        `INSERT INTO area_election_data (area_code, party, votes) VALUES ${batch.join(", ")};`
      );
      batch = [];
    }
  }
}
if (batch.length > 0) {
  sqlLines.push(
    `INSERT INTO area_election_data (area_code, party, votes) VALUES ${batch.join(", ")};`
  );
}

fs.writeFileSync(outputPath, sqlLines.join("\n") + "\n");

console.log(`\nResults:`);
console.log(`  Processed: ${processed} stembureau-party rows`);
console.log(`  Skipped (no PC6 mapping): ${skippedNoMapping}`);
console.log(`  Buurten: ${Object.keys(byBuurt).length}`);
console.log(`  Wijken: ${Object.keys(byWijk).length}`);
console.log(`  Total area-party rows: ${
  Object.values(allAreas).reduce(
    (sum, p) => sum + Object.keys(p).length,
    0
  )
}`);
console.log(`  SQL statements: ${sqlLines.length}`);
console.log(`  Output: ${outputPath}`);
