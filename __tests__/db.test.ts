import { getPostcodeData, setPostcodeData, initDb } from "@/lib/db";
import path from "path";
import fs from "fs";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-postcodes.db");

beforeEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  initDb(TEST_DB_PATH);
});

afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

const sampleData = {
  code: "1011",
  location: "Amsterdam, Noord-Holland",
  quickStats: {
    wozValue: { value: 588000, year: 2023 },
    avgIncome: { value: 38200, year: 2022 },
    population: { value: 9940, year: 2025 },
    households: { value: 6670, year: 2024 },
  },
  amenities: {
    supermarket: { distance: 0.5, unit: "km" },
    gp: { distance: 0.5, unit: "km" },
    primarySchool: { distance: 0.6, unit: "km" },
  },
  migration: {
    year: 2025,
    breakdown: [
      { origin: "Nederland", count: 5010, percentage: 50 },
      { origin: "Europa", count: 2170, percentage: 22 },
      { origin: "Overig", count: 2760, percentage: 28 },
    ],
  },
  housingTypes: {
    ownership: { koop: 30, huur: 70 },
    buildingType: { appartement: 96, huis: 4 },
  },
};

describe("db", () => {
  test("returns null for unknown postcode", () => {
    const result = getPostcodeData("9999");
    expect(result).toBeNull();
  });

  test("stores and retrieves postcode data", () => {
    setPostcodeData("1011", sampleData);
    const result = getPostcodeData("1011");
    expect(result).toEqual(sampleData);
  });

  test("overwrites existing data for same postcode", () => {
    setPostcodeData("1011", sampleData);
    const updated = { ...sampleData, location: "Updated" };
    setPostcodeData("1011", updated);
    const result = getPostcodeData("1011");
    expect(result?.location).toBe("Updated");
  });
});
