import { PostcodeData } from "./types";

function parseNumber(text: string): number {
  const cleaned = text.replace(/[€\s%]/g, "").trim();
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return parseInt(cleaned.replace(/\./g, ""), 10);
}

function parsePercentage(text: string): number {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Strip HTML tags from a string
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

export function parsePostcodePage(code: string, html: string): PostcodeData {
  // Extract all table rows: <tr>...<td>label</td><td>value</td><td>unit</td><td>year</td>...</tr>
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  // Build a lookup of label → { value, year }
  const rows: Array<{ label: string; value: string; year: string }> = [];
  let rowMatch;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    let cellMatch;
    cellPattern.lastIndex = 0;
    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length >= 2) {
      rows.push({
        label: cells[0],
        value: cells[1],
        year: cells.length >= 4 ? cells[3] : "",
      });
    }
  }

  function findRowValue(labelPattern: string): string {
    const lp = labelPattern.toLowerCase();
    for (const row of rows) {
      if (row.label.toLowerCase().includes(lp)) {
        return row.value;
      }
    }
    return "";
  }

  function findRowYear(labelPattern: string): number {
    const lp = labelPattern.toLowerCase();
    for (const row of rows) {
      if (row.label.toLowerCase().includes(lp) && row.year) {
        return parseInt(row.year, 10);
      }
    }
    return 0;
  }

  const gemeente = findRowValue("gemeentenaam") || "Unknown";
  const provincie = findRowValue("provincienaam") || "";
  const location = provincie ? `${gemeente}, ${provincie}` : gemeente;

  const wozText = findRowValue("gemiddelde woningwaarde");
  const wozYear = findRowYear("gemiddelde woningwaarde");

  // Prefer per-person income; fall back to household income
  let incomeText = findRowValue("gemiddeld inkomen per inwoner");
  let incomeYear = findRowYear("gemiddeld inkomen per inwoner");
  if (!incomeText || parseNumber(incomeText) === 0) {
    incomeText = findRowValue("gemiddeld huishoudinkomen");
    incomeYear = findRowYear("gemiddeld huishoudinkomen");
  }

  const popText = findRowValue("inwoners");
  const popYear = findRowYear("inwoners");
  const householdsText = findRowValue("huishoudens");
  const householdsYear = findRowYear("huishoudens");

  const supermarketText = findRowValue("supermarkt afstand");
  const gpText = findRowValue("huisartsenpraktijk afstand");
  const schoolText = findRowValue("basisonderwijs afstand");

  const nlCount = findRowValue("herkomst nederland");
  const euCount = findRowValue("herkomst europa");
  const nonEuCount = findRowValue("herkomst buiten europa");
  const migrationYear = findRowYear("herkomst nederland");

  const nlNum = parseNumber(nlCount) || 0;
  const euNum = parseNumber(euCount) || 0;
  const nonEuNum = parseNumber(nonEuCount) || 0;
  const totalMigration = nlNum + euNum + nonEuNum;

  const koopPct = findRowValue("% koopwoningen");
  const huurPct = findRowValue("% huurwoningen");
  const appartPct = findRowValue("% appartementen");
  const huisPct = findRowValue("% eengezinswoningen");

  return {
    code,
    location,
    quickStats: {
      wozValue: { value: parseNumber(wozText) || 0, year: wozYear || new Date().getFullYear() },
      avgIncome: { value: parseNumber(incomeText) || 0, year: incomeYear || new Date().getFullYear() },
      population: { value: parseNumber(popText) || 0, year: popYear || new Date().getFullYear() },
      households: { value: parseNumber(householdsText) || 0, year: householdsYear || new Date().getFullYear() },
    },
    amenities: {
      supermarket: { distance: parseNumber(supermarketText) || 0, unit: "km" },
      gp: { distance: parseNumber(gpText) || 0, unit: "km" },
      primarySchool: { distance: parseNumber(schoolText) || 0, unit: "km" },
    },
    migration: {
      year: migrationYear || new Date().getFullYear(),
      breakdown: [
        { origin: "Nederland", count: nlNum, percentage: totalMigration ? Math.round((nlNum / totalMigration) * 100) : 0 },
        { origin: "Europa", count: euNum, percentage: totalMigration ? Math.round((euNum / totalMigration) * 100) : 0 },
        { origin: "Overig", count: nonEuNum, percentage: totalMigration ? Math.round((nonEuNum / totalMigration) * 100) : 0 },
      ],
    },
    housingTypes: {
      ownership: { koop: parsePercentage(koopPct), huur: parsePercentage(huurPct) },
      buildingType: { appartement: parsePercentage(appartPct), huis: parsePercentage(huisPct) },
    },
  };
}

export async function scrapePostcode(code: string): Promise<PostcodeData> {
  const url = `https://allecijfers.nl/postcode/${code}/`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch postcode ${code}: ${response.status}`);
  }
  const html = await response.text();
  return parsePostcodePage(code, html);
}
