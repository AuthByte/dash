import { NextResponse } from "next/server";
import { getEnrichedPick, getPersonBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ person: string; ticker: string }> },
) {
  const { person, ticker } = await ctx.params;
  const profile = getPersonBySlug(person);
  if (!profile) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const pick = getEnrichedPick(person, decodeURIComponent(ticker));
  if (!pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  return NextResponse.json(pick, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
