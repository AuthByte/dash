import { NextResponse } from "next/server";
import { getPeople } from "@/lib/data";
import { hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let peopleCount = 0;
  let dataOk = false;
  let error: string | null = null;
  try {
    const people = await getPeople();
    peopleCount = people.length;
    dataOk = peopleCount > 0;
  } catch (err) {
    error = err instanceof Error ? err.message : "unknown";
  }
  const status = dataOk ? 200 : 503;
  return NextResponse.json(
    {
      ok: dataOk,
      people: peopleCount,
      supabaseConfigured: hasSupabaseConfig(),
      error,
      latencyMs: Date.now() - started,
    },
    { status },
  );
}
