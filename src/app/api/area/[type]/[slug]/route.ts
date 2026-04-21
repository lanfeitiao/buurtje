import { NextResponse } from "next/server";
import {
  getPostcodeData,
  setPostcodeData,
  getElectionData,
  getAreaElectionData,
} from "@/lib/db";
import { parsePostcodePage } from "@/lib/scraper";

async function resolveElection(
  areaCode: string,
  fallbackPostcode: string
) {
  // Prefer buurt/wijk-specific election data when available
  if (areaCode) {
    const areaElection = await getAreaElectionData(areaCode);
    if (areaElection) return areaElection;
  }
  // Fall back to postcode-level data
  if (fallbackPostcode) {
    return await getElectionData(fallbackPostcode);
  }
  return null;
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/area/[type]/[slug]">
) {
  const { type, slug } = await ctx.params;

  if (type !== "buurt" && type !== "wijk") {
    return NextResponse.json({ error: "Invalid area type." }, { status: 400 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const areaCode = url.searchParams.get("areaCode") || "";

  const cacheKey = `${type}:${slug}`;

  const cached = await getPostcodeData(cacheKey);
  if (cached) {
    const election = await resolveElection(areaCode, code);
    return NextResponse.json({ ...cached, election: election ?? undefined });
  }

  try {
    const areaUrl = `https://allecijfers.nl/${type}/${slug}/`;
    const response = await fetch(areaUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const html = await response.text();
    const data = parsePostcodePage(cacheKey, html);

    // Override the code and location to show the area name nicely
    const prettyName = slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    data.code = cacheKey;
    data.location = `${prettyName} (${type})`;

    await setPostcodeData(cacheKey, data);

    const election = await resolveElection(areaCode, code);
    return NextResponse.json({ ...data, election: election ?? undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("404")) {
      return NextResponse.json(
        { error: `Area ${slug} not found.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch data. Please try again later." },
      { status: 502 }
    );
  }
}
