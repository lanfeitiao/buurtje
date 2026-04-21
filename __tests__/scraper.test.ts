import { parsePostcodePage } from "@/lib/scraper";
import fs from "fs";
import path from "path";

const html = fs.readFileSync(
  path.join(__dirname, "fixtures", "postcode-1011.html"),
  "utf-8"
);

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
