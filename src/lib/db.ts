import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PostcodeData } from "./types";

function getDb(): D1Database {
  return getCloudflareContext().env.DB;
}

export async function getPostcodeData(
  code: string
): Promise<PostcodeData | null> {
  const row = await getDb()
    .prepare("SELECT data FROM postcode_data WHERE code = ?")
    .bind(code)
    .first<{ data: string }>();
  if (!row) return null;
  return JSON.parse(row.data) as PostcodeData;
}

export async function setPostcodeData(
  code: string,
  data: PostcodeData
): Promise<void> {
  await getDb()
    .prepare(
      "INSERT OR REPLACE INTO postcode_data (code, data) VALUES (?, ?)"
    )
    .bind(code, JSON.stringify(data))
    .run();
}

type ElectionWithoutSource = Omit<NonNullable<PostcodeData["election"]>, "source">;

async function queryElectionRows(
  sql: string,
  bind: string
): Promise<{ party: string; votes: number }[] | null> {
  // Election data is optional — a missing table or DB-layer error should
  // degrade gracefully (no election section) rather than fail the whole
  // request. Cache lookups (postcode_data) and the scrape path stay strict.
  try {
    const rows = await getDb()
      .prepare(sql)
      .bind(bind)
      .all<{ party: string; votes: number }>();
    return rows.results ?? null;
  } catch (err) {
    console.warn("Election table query failed; returning null.", err);
    return null;
  }
}

export function buildElection(
  rows: { party: string; votes: number }[] | null
): ElectionWithoutSource | null {
  if (!rows || rows.length === 0) return null;
  const totalVotes = rows.reduce((sum, r) => sum + r.votes, 0);
  return {
    year: 2025,
    parties: rows.map((r) => ({
      name: r.party,
      votes: r.votes,
      percentage: Math.round((r.votes / totalVotes) * 1000) / 10,
    })),
    totalVotes,
  };
}

export async function getElectionData(
  code: string
): Promise<ElectionWithoutSource | null> {
  const rows = await queryElectionRows(
    "SELECT party, votes FROM election_data WHERE postcode = ? ORDER BY votes DESC",
    code
  );
  return buildElection(rows);
}

export async function getAreaElectionData(
  areaCode: string
): Promise<ElectionWithoutSource | null> {
  const rows = await queryElectionRows(
    "SELECT party, votes FROM area_election_data WHERE area_code = ? ORDER BY votes DESC",
    areaCode
  );
  return buildElection(rows);
}

export type SchoolRow = {
  brin: string;
  name: string;
  street: string | null;
  huisnummer: string | null;
  postcode: string;
  city: string | null;
  denominatie: string | null;
  lat: number;
  lon: number;
};

export async function getSchoolsInBbox(
  south: number,
  west: number,
  north: number,
  east: number,
  limit = 500
): Promise<SchoolRow[]> {
  const rows = await getDb()
    .prepare(
      "SELECT brin, name, street, huisnummer, postcode, city, denominatie, lat, lon FROM schools WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT ?"
    )
    .bind(south, north, west, east, limit)
    .all<SchoolRow>();
  return rows.results ?? [];
}
