/**
 * Generate SQL INSERT statements from TK2025 election CSV for D1 import.
 * Outputs a .sql file that can be executed with `wrangler d1 execute`.
 *
 * Usage: npx tsx scripts/generate-election-sql.ts <csv-path> <output-sql-path>
 */

import fs from "fs";

const csvPath = process.argv[2];
const outputPath = process.argv[3] || "election-data.sql";

if (!csvPath || !fs.existsSync(csvPath)) {
  console.error(
    "Usage: npx tsx scripts/generate-election-sql.ts <csv-path> [output-sql-path]"
  );
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw.split("\n");

// Aggregate by 4-digit postcode
const aggregated: Record<string, Record<string, number>> = {};
let recoveredFromName = 0;
let skipped = 0;

function extractPostcode(
  csvField: string,
  stembureauName: string
): string | null {
  if (csvField && csvField.length >= 4) return csvField;
  const match = stembureauName.match(/(\d{4})\s*[A-Z]{2}/);
  return match ? match[0] : null;
}

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(";").map((s) => s.replace(/^"|"$/g, ""));
  const postcodeField = parts[2];
  const stembureauName = parts[3];
  const party = parts[5];
  const votes = parseInt(parts[6], 10);

  const postcode6 = extractPostcode(postcodeField, stembureauName);
  if (!postcode6) {
    skipped++;
    continue;
  }
  if (!postcodeField || postcodeField.length < 4) recoveredFromName++;

  const postcode4 = postcode6.substring(0, 4);
  if (!aggregated[postcode4]) aggregated[postcode4] = {};
  aggregated[postcode4][party] = (aggregated[postcode4][party] || 0) + votes;
}

// Generate SQL - D1 has a 100-row limit per INSERT, so batch them
const sqlLines: string[] = [];
sqlLines.push("DELETE FROM election_data;");

let batch: string[] = [];
for (const [postcode, parties] of Object.entries(aggregated)) {
  for (const [party, votes] of Object.entries(parties)) {
    const escapedParty = party.replace(/'/g, "''");
    batch.push(`('${postcode}', '${escapedParty}', ${votes})`);

    if (batch.length >= 50) {
      sqlLines.push(
        `INSERT INTO election_data (postcode, party, votes) VALUES ${batch.join(", ")};`
      );
      batch = [];
    }
  }
}
if (batch.length > 0) {
  sqlLines.push(
    `INSERT INTO election_data (postcode, party, votes) VALUES ${batch.join(", ")};`
  );
}

fs.writeFileSync(outputPath, sqlLines.join("\n") + "\n");

const postcodeCount = Object.keys(aggregated).length;
console.log(`Generated ${outputPath}:`);
console.log(`  ${postcodeCount} postcode areas`);
console.log(`  ${recoveredFromName} rows recovered from name`);
console.log(`  ${skipped} rows skipped`);
console.log(`  ${sqlLines.length} SQL statements`);
