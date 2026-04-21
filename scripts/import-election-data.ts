/**
 * Import TK2025 election results from CSV into SQLite,
 * aggregated by 4-digit postcode area.
 *
 * Usage: npx tsx scripts/import-election-data.ts <path-to-csv>
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error(
    "Usage: npx tsx scripts/import-election-data.ts <path-to-TK2025-csv>"
  );
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "data", "postcodes.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Create election table
db.exec(`
  CREATE TABLE IF NOT EXISTS election_data (
    postcode TEXT NOT NULL,
    party TEXT NOT NULL,
    votes INTEGER NOT NULL,
    PRIMARY KEY (postcode, party)
  )
`);
db.exec(`DELETE FROM election_data`);

// Parse CSV (semicolon-delimited, quoted fields)
const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.split("\n");

// Aggregate: { "1011": { "GL-PvdA": 1234, "VVD": 567, ... } }
const aggregated: Record<string, Record<string, number>> = {};
let skipped = 0;
let recoveredFromName = 0;

function extractPostcode(csvField: string, stembureauName: string): string | null {
  // Primary: use the Postcode CSV column
  if (csvField && csvField.length >= 4) return csvField;

  // Fallback: extract from stembureau name, e.g. "(postcode: 8431LE)"
  const match = stembureauName.match(/(\d{4})\s*[A-Z]{2}/);
  return match ? match[0] : null;
}

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Split by semicolon, strip quotes
  const parts = line.split(";").map((s) => s.replace(/^"|"$/g, ""));
  const postcodeField = parts[2]; // e.g. "9712HN" or empty
  const stembureauName = parts[3]; // may contain postcode
  const party = parts[5];
  const votes = parseInt(parts[6], 10);

  const postcode6 = extractPostcode(postcodeField, stembureauName);
  if (!postcode6) {
    skipped++;
    continue;
  }

  if (!postcodeField || postcodeField.length < 4) {
    recoveredFromName++;
  }

  const postcode4 = postcode6.substring(0, 4);

  if (!aggregated[postcode4]) {
    aggregated[postcode4] = {};
  }
  aggregated[postcode4][party] = (aggregated[postcode4][party] || 0) + votes;
}

// Insert into SQLite
const insert = db.prepare(
  "INSERT INTO election_data (postcode, party, votes) VALUES (?, ?, ?)"
);

const insertAll = db.transaction(() => {
  for (const [postcode, parties] of Object.entries(aggregated)) {
    for (const [party, votes] of Object.entries(parties)) {
      insert.run(postcode, party, votes);
    }
  }
});

insertAll();

const postcodeCount = Object.keys(aggregated).length;
const rowCount = Object.values(aggregated).reduce(
  (sum, parties) => sum + Object.keys(parties).length,
  0
);

console.log(`Imported TK2025 election data:`);
console.log(`  ${postcodeCount} postcode areas`);
console.log(`  ${rowCount} postcode-party rows`);
console.log(`  ${recoveredFromName} rows recovered from stembureau name`);
console.log(`  ${skipped} rows skipped (no postcode found anywhere)`);

db.close();
