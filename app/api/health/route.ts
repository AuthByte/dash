import { NextResponse } from "next/server";
import { getPeople } from "@/lib/data";
import { hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let peopleCount = 0;
  let dataOk = false;
  try {
    const people = await getPeople();
    peopleCount = people.length;
    dataOk = peopleCount > 0;
  } catch {
    dataOk = false;
  }
  const status = dataOk ? 200 : 503;
  return NextResponse.json(
    {
      ok: dataOk,
      people: peopleCount,
      supabaseConfigured: hasSupabaseConfig(),
      latencyMs: Date.now() - started,
    },
    { status },
  );
}
