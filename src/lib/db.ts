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

export async function getElectionData(
  code: string
): Promise<PostcodeData["election"] | null> {
  const rows = await getDb()
    .prepare(
      "SELECT party, votes FROM election_data WHERE postcode = ? ORDER BY votes DESC"
    )
    .bind(code)
    .all<{ party: string; votes: number }>();

  if (!rows.results || rows.results.length === 0) return null;

  const totalVotes = rows.results.reduce((sum, r) => sum + r.votes, 0);

  return {
    year: 2025,
    parties: rows.results.map((r) => ({
      name: r.party,
      votes: r.votes,
      percentage: Math.round((r.votes / totalVotes) * 1000) / 10,
    })),
    totalVotes,
  };
}

export async function getAreaElectionData(
  areaCode: string
): Promise<PostcodeData["election"] | null> {
  const rows = await getDb()
    .prepare(
      "SELECT party, votes FROM area_election_data WHERE area_code = ? ORDER BY votes DESC"
    )
    .bind(areaCode)
    .all<{ party: string; votes: number }>();

  if (!rows.results || rows.results.length === 0) return null;

  const totalVotes = rows.results.reduce((sum, r) => sum + r.votes, 0);

  return {
    year: 2025,
    parties: rows.results.map((r) => ({
      name: r.party,
      votes: r.votes,
      percentage: Math.round((r.votes / totalVotes) * 1000) / 10,
    })),
    totalVotes,
  };
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
