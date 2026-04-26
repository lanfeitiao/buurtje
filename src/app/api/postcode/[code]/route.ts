import { NextResponse } from "next/server";
import { getPostcodeData, setPostcodeData, getElectionData } from "@/lib/db";
import { scrapePostcode } from "@/lib/scraper";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/postcode/[code]">
) {
  const { code } = await ctx.params;

  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json(
      { error: "Invalid postcode. Must be 4 digits." },
      { status: 400 }
    );
  }

  const cached = await getPostcodeData(code);
  if (cached) {
    const election = await getElectionData(code);
    return NextResponse.json({
      ...cached,
      election: election
        ? { ...election, source: { kind: "postcode", code } }
        : undefined,
    });
  }

  try {
    const data = await scrapePostcode(code);
    await setPostcodeData(code, data);
    const election = await getElectionData(code);
    return NextResponse.json({
      ...data,
      election: election
        ? { ...election, source: { kind: "postcode", code } }
        : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("404")) {
      return NextResponse.json(
        { error: `Postcode ${code} not found.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch data. Please try again later." },
      { status: 502 }
    );
  }
}
