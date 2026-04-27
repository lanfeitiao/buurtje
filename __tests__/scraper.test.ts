import { parsePostcodePage } from "@/lib/scraper";
import fs from "fs";
import path from "path";

const html = fs.readFileSync(
  path.join(__dirname, "fixtures", "postcode-1011.html"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Helper: build minimal HTML tables for edge-case tests
// ---------------------------------------------------------------------------

/** Rows: [label, value, year] */
function makeHtml(rows: [string, string, string][]): string {
  const trs = rows
    .map(
      ([label, value, year]) =>
        `<tr><td>${label}</td><td>${value}</td><td></td><td>${year}</td></tr>`
    )
    .join("\n");
  return `<html><body><table>${trs}</table></body></html>`;
}

describe("parsePostcodePage", () => {
  const result = parsePostcodePage("1011", html);

  test("extracts location name", () => {
    expect(result.code).toBe("1011");
    expect(result.location).toContain("Amsterdam");
  });

  test("extracts WOZ value", () => {
    expect(result.quickStats.wozValue.value).toBeGreaterThan(100000);
    expect(result.quickStats.wozValue.year).toBeGreaterThanOrEqual(2020);
  });

  test("extracts average income", () => {
    expect(result.quickStats.avgIncome.value).toBeGreaterThan(10000);
    expect(result.quickStats.avgIncome.year).toBeGreaterThanOrEqual(2020);
  });

  test("extracts population", () => {
    expect(result.quickStats.population.value).toBeGreaterThan(0);
  });

  test("extracts households", () => {
    expect(result.quickStats.households.value).toBeGreaterThan(0);
  });

  test("extracts amenity distances", () => {
    expect(result.amenities.supermarket.distance).toBeGreaterThan(0);
    expect(result.amenities.supermarket.unit).toBe("km");
    expect(result.amenities.gp.distance).toBeGreaterThan(0);
    expect(result.amenities.primarySchool.distance).toBeGreaterThan(0);
  });

  test("extracts migration breakdown", () => {
    expect(result.migration.breakdown.length).toBeGreaterThanOrEqual(3);
    const total = result.migration.breakdown.reduce(
      (sum, b) => sum + b.percentage,
      0
    );
    expect(total).toBeGreaterThanOrEqual(95);
    expect(total).toBeLessThanOrEqual(105);
  });

  test("extracts housing ownership", () => {
    const { koop, huur } = result.housingTypes.ownership;
    expect(koop + huur).toBeGreaterThanOrEqual(95);
    expect(koop + huur).toBeLessThanOrEqual(105);
  });

  test("extracts building types", () => {
    const types = result.housingTypes.buildingType;
    expect(Object.keys(types).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("parsePostcodePage edge cases", () => {
  test("returns safe defaults for completely empty HTML", () => {
    const r = parsePostcodePage("9999", "");
    expect(r.code).toBe("9999");
    expect(r.location).toBe("Unknown");
    expect(r.quickStats.wozValue.value).toBe(0);
    expect(r.quickStats.avgIncome.value).toBe(0);
    expect(r.quickStats.population.value).toBe(0);
    expect(r.quickStats.households.value).toBe(0);
    expect(r.amenities.supermarket.distance).toBe(0);
    expect(r.migration.breakdown).toHaveLength(3);
    expect(r.migration.breakdown.every((b) => b.count === 0 && b.percentage === 0)).toBe(true);
    expect(r.householdComposition).toBeUndefined();
  });

  test("omits province from location when provincienaam row is absent", () => {
    const h = makeHtml([["gemeentenaam", "Utrecht", ""]]);
    const r = parsePostcodePage("3511", h);
    expect(r.location).toBe("Utrecht");
    expect(r.location).not.toContain(",");
  });

  test("includes province in location when provincienaam row is present", () => {
    const h = makeHtml([
      ["gemeentenaam", "Utrecht", ""],
      ["provincienaam", "Utrecht", ""],
    ]);
    const r = parsePostcodePage("3511", h);
    expect(r.location).toBe("Utrecht, Utrecht");
  });

  test("falls back to household income when per-person income is absent", () => {
    const h = makeHtml([
      ["gemeentenaam", "Rotterdam", ""],
      ["gemiddeld huishoudinkomen", "45.000", "2022"],
    ]);
    const r = parsePostcodePage("3011", h);
    expect(r.quickStats.avgIncome.value).toBe(45000);
    expect(r.quickStats.avgIncome.year).toBe(2022);
  });

  test("prefers per-person income over household income when both present", () => {
    const h = makeHtml([
      ["gemeentenaam", "Rotterdam", ""],
      ["gemiddeld inkomen per inwoner", "32.000", "2023"],
      ["gemiddeld huishoudinkomen", "60.000", "2022"],
    ]);
    const r = parsePostcodePage("3011", h);
    expect(r.quickStats.avgIncome.value).toBe(32000);
    expect(r.quickStats.avgIncome.year).toBe(2023);
  });

  test("populates householdComposition when all three household types are present", () => {
    const h = makeHtml([
      ["gemeentenaam", "Amsterdam", ""],
      ["huishoudens", "1.800", "2024"],
      ["eenpersoonshuishoudens", "1.000", "2024"],
      ["meerpersoonshuishoudens zonder kinderen", "500", "2024"],
      ["meerpersoonshuishoudens met kinderen", "300", "2024"],
    ]);
    const r = parsePostcodePage("1011", h);
    expect(r.householdComposition).toBeDefined();
    expect(r.householdComposition!.single).toBe(1000);
    expect(r.householdComposition!.withoutKids).toBe(500);
    expect(r.householdComposition!.withKids).toBe(300);
    expect(r.householdComposition!.year).toBe(2024);
  });

  test("householdComposition is undefined when no household composition rows are present", () => {
    const h = makeHtml([["gemeentenaam", "Amsterdam", ""]]);
    const r = parsePostcodePage("1011", h);
    expect(r.householdComposition).toBeUndefined();
  });

  test("migration percentages sum to 100 when all three origin groups are present", () => {
    const h = makeHtml([
      ["gemeentenaam", "Amsterdam", ""],
      ["herkomst nederland", "5.000", "2024"],
      ["herkomst europa", "2.000", "2024"],
      ["herkomst buiten europa", "3.000", "2024"],
    ]);
    const r = parsePostcodePage("1011", h);
    const total = r.migration.breakdown.reduce((s, b) => s + b.percentage, 0);
    // The implementation uses Math.round() on each percentage independently,
    // so each of the three groups can be off by ±0.5, giving a worst-case
    // total drift of ±1.5 → we allow ±2 to be safe.
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
    expect(r.migration.breakdown[0].count).toBe(5000);
    expect(r.migration.breakdown[1].count).toBe(2000);
    expect(r.migration.breakdown[2].count).toBe(3000);
  });

  test("parses Dutch-formatted numbers with period as thousands separator", () => {
    const h = makeHtml([
      ["gemeentenaam", "Amsterdam", ""],
      ["gemiddelde woningwaarde", "€ 1.234.567", "2023"],
    ]);
    const r = parsePostcodePage("1011", h);
    expect(r.quickStats.wozValue.value).toBe(1234567);
  });
});
