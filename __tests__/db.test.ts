// Intercept the ESM module before it is loaded
jest.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: jest.fn(),
}));

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getPostcodeData,
  setPostcodeData,
  getElectionData,
  getAreaElectionData,
  getSchoolsInBbox,
  buildElection,
} from "@/lib/db";
import type { PostcodeData } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helper: build a chainable mock D1 database
// ---------------------------------------------------------------------------

type D1Mock = ReturnType<typeof makeMockDb>;

function makeMockDb(opts: {
  firstResult?: unknown;
  allResults?: unknown[];
  throwOnAll?: boolean;
}) {
  const first = jest.fn().mockResolvedValue(opts.firstResult ?? null);
  const run = jest.fn().mockResolvedValue(undefined);
  const all = opts.throwOnAll
    ? jest.fn().mockRejectedValue(new Error("DB error"))
    : jest.fn().mockResolvedValue({ results: opts.allResults ?? [] });
  const bind = jest.fn(() => ({ first, run, all }));
  const prepare = jest.fn(() => ({ bind }));
  return { prepare, _bind: bind, _first: first, _run: run, _all: all };
}

function installDb(db: D1Mock) {
  (getCloudflareContext as jest.Mock).mockReturnValue({ env: { DB: db } });
}

const sampleData: PostcodeData = {
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

// ---------------------------------------------------------------------------
// buildElection — pure function, no DB needed
// ---------------------------------------------------------------------------

describe("buildElection", () => {
  test("returns null for null input", () => {
    expect(buildElection(null)).toBeNull();
  });

  test("returns null for empty array", () => {
    expect(buildElection([])).toBeNull();
  });

  test("builds election object with correct totalVotes", () => {
    const result = buildElection([
      { party: "PVV", votes: 600 },
      { party: "VVD", votes: 400 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.totalVotes).toBe(1000);
    expect(result!.year).toBe(2025);
  });

  test("calculates party percentages rounded to 1 decimal place", () => {
    const result = buildElection([
      { party: "PVV", votes: 1 },
      { party: "VVD", votes: 2 },
    ])!;
    // PVV: Math.round(1/3 * 1000) / 10 = Math.round(333.3) / 10 = 333 / 10 = 33.3
    expect(result.parties[0]).toEqual({ name: "PVV", votes: 1, percentage: 33.3 });
    // VVD: Math.round(2/3 * 1000) / 10 = Math.round(666.7) / 10 = 667 / 10 = 66.7
    expect(result.parties[1]).toEqual({ name: "VVD", votes: 2, percentage: 66.7 });
  });

  test("preserves party order from input", () => {
    const result = buildElection([
      { party: "Alpha", votes: 10 },
      { party: "Beta", votes: 90 },
    ])!;
    expect(result.parties.map((p) => p.name)).toEqual(["Alpha", "Beta"]);
  });
});

// ---------------------------------------------------------------------------
// getPostcodeData
// ---------------------------------------------------------------------------

describe("getPostcodeData", () => {
  test("returns null when the row is not found", async () => {
    installDb(makeMockDb({ firstResult: null }));
    const result = await getPostcodeData("9999");
    expect(result).toBeNull();
  });

  test("parses and returns PostcodeData from the stored JSON row", async () => {
    installDb(makeMockDb({ firstResult: { data: JSON.stringify(sampleData) } }));
    const result = await getPostcodeData("1011");
    expect(result).toEqual(sampleData);
  });
});

// ---------------------------------------------------------------------------
// setPostcodeData
// ---------------------------------------------------------------------------

describe("setPostcodeData", () => {
  test("runs an INSERT OR REPLACE statement with serialized JSON", async () => {
    const db = makeMockDb({});
    installDb(db);
    await setPostcodeData("1011", sampleData);
    expect(db._run).toHaveBeenCalledTimes(1);
    // Verify the bind was called with the code and the JSON-serialized data
    expect(db._bind).toHaveBeenCalledWith("1011", JSON.stringify(sampleData));
  });
});

// ---------------------------------------------------------------------------
// getElectionData
// ---------------------------------------------------------------------------

describe("getElectionData", () => {
  test("returns null when no election rows exist", async () => {
    installDb(makeMockDb({ allResults: [] }));
    const result = await getElectionData("1011");
    expect(result).toBeNull();
  });

  test("returns built election data when rows are present", async () => {
    installDb(
      makeMockDb({
        allResults: [
          { party: "PVV", votes: 100 },
          { party: "VVD", votes: 50 },
        ],
      })
    );
    const result = await getElectionData("1011");
    expect(result).not.toBeNull();
    expect(result!.totalVotes).toBe(150);
    expect(result!.parties).toHaveLength(2);
  });

  test("returns null and does not throw when the DB query fails", async () => {
    installDb(makeMockDb({ throwOnAll: true }));
    await expect(getElectionData("1011")).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAreaElectionData
// ---------------------------------------------------------------------------

describe("getAreaElectionData", () => {
  test("returns null when no area election rows exist", async () => {
    installDb(makeMockDb({ allResults: [] }));
    const result = await getAreaElectionData("BU0363000");
    expect(result).toBeNull();
  });

  test("returns built election data for the given area code", async () => {
    installDb(
      makeMockDb({
        allResults: [
          { party: "D66", votes: 200 },
          { party: "GL-PvdA", votes: 300 },
        ],
      })
    );
    const result = await getAreaElectionData("BU0363000");
    expect(result!.totalVotes).toBe(500);
    expect(result!.parties[0].name).toBe("D66");
  });

  test("returns null and does not throw when the DB query fails", async () => {
    installDb(makeMockDb({ throwOnAll: true }));
    await expect(getAreaElectionData("BU0363000")).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSchoolsInBbox
// ---------------------------------------------------------------------------

describe("getSchoolsInBbox", () => {
  test("returns an empty array when no schools are in the bbox", async () => {
    installDb(makeMockDb({ allResults: [] }));
    const result = await getSchoolsInBbox(52.3, 4.8, 52.4, 4.9);
    expect(result).toEqual([]);
  });

  test("returns school rows from the DB", async () => {
    const schoolRow = {
      brin: "01AB",
      name: "Test School",
      street: "Teststraat",
      huisnummer: "1",
      postcode: "1011AA",
      city: "Amsterdam",
      denominatie: "Openbaar",
      lat: 52.37,
      lon: 4.89,
    };
    installDb(makeMockDb({ allResults: [schoolRow] }));
    const result = await getSchoolsInBbox(52.3, 4.8, 52.4, 4.9);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(schoolRow);
  });

  test("passes bbox and default limit to the DB query", async () => {
    const db = makeMockDb({ allResults: [] });
    installDb(db);
    await getSchoolsInBbox(1, 2, 3, 4);
    expect(db._bind).toHaveBeenCalledWith(1, 3, 2, 4, 500);
  });

  test("passes a custom limit when provided", async () => {
    const db = makeMockDb({ allResults: [] });
    installDb(db);
    await getSchoolsInBbox(1, 2, 3, 4, 10);
    expect(db._bind).toHaveBeenCalledWith(1, 3, 2, 4, 10);
  });
});
