import { NextResponse } from "next/server";
import { getSchoolsInBbox } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bbox = url.searchParams.get("bbox");
  if (!bbox) {
    return NextResponse.json(
      { error: "bbox query param required (south,west,north,east)" },
      { status: 400 }
    );
  }

  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json(
      { error: "bbox must be four comma-separated numbers" },
      { status: 400 }
    );
  }
  const [south, west, north, east] = parts;
  if (south > north || west > east) {
    return NextResponse.json(
      { error: "bbox must be south,west,north,east with south<=north and west<=east" },
      { status: 400 }
    );
  }

  try {
    const schools = await getSchoolsInBbox(south, west, north, east);
    return NextResponse.json({ schools });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
