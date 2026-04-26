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
