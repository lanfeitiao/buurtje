export interface PostcodeData {
  code: string;
  location: string;
  quickStats: {
    wozValue: { value: number; year: number };
    avgIncome: { value: number; year: number };
    population: { value: number; year: number };
    households: { value: number; year: number };
  };
  amenities: {
    supermarket: { distance: number; unit: string };
    gp: { distance: number; unit: string };
    primarySchool: { distance: number; unit: string };
  };
  migration: {
    year: number;
    breakdown: Array<{
      origin: string;
      count: number;
      percentage: number;
    }>;
  };
  housingTypes: {
    ownership: { koop: number; huur: number };
    buildingType: Record<string, number>;
  };
  householdComposition?: {
    year: number;
    total: number;
    single: number;
    withoutKids: number;
    withKids: number;
  };
  election?: {
    year: number;
    parties: Array<{
      name: string;
      votes: number;
      percentage: number;
    }>;
    totalVotes: number;
    source: { kind: "area" } | { kind: "postcode"; code: string };
  };
}

export type HistoryEntry = {
  query: string;
  label: string;
  kind: "postcode" | "buurt" | "wijk";
  timestamp: number;
};

export type CompareEntry = {
  query: string;
  label: string;
  kind: "postcode" | "buurt" | "wijk";
  addedAt: number;
};

export type SchoolAdvies = {
  year: string;
  speciaal_praktijk: number;
  vmbo_b_k: number;
  vmbo_t: number;
  havo: number;
  vwo: number;
  overig: number;
};

export type SchoolScore = {
  toets: string;
  year: string;
  score: number;
};

// One row in public/schools/<gemeente>/index.json. Slim list shared by
// SchoolsMap (markers) and SchoolsTable (rows).
export type SchoolIndexEntry = {
  slug: string;
  name: string;
  lat: number | null;
  lon: number | null;
  denominatie: string | null;
  buurt: string | null;
  buurtSlug: string | null;
  latestLeerlingen: number | null;
  latestScore: SchoolScore | null;
  latestAdvies: SchoolAdvies | null;
};

// Per-buurt input shared by all `/compare` chart components.
// Each chart receives its data column already paired with a stable
// palette colour and the resolved PostcodeData (or null when fetching
// failed for that column).
export interface CompareDataColumn {
  entry: CompareEntry;
  color: string;
  data: PostcodeData | null;
}
