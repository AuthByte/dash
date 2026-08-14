import { NextResponse } from "next/server";
import { getEnrichedPick, getPersonBySlug } from "@/lib/data";
import { isAllowedTicker } from "@/lib/history";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ person: string; ticker: string }> },
) {
  const { person, ticker: rawTicker } = await ctx.params;
  const ticker = decodeURIComponent(rawTicker).trim();
  if (!isAllowedTicker(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const profile = await getPersonBySlug(person);
  if (!profile) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const pick = await getEnrichedPick(person, ticker);
  if (!pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  return NextResponse.json(pick, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
