import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getEnrichedPicks,
  getHeadlineStats,
  getPeople,
  getPersonBySlug,
  getSiteMeta,
  getThemeStats,
  getThemes,
} from "@/lib/data";
import { Hero } from "../components/Hero";
import { ThesisBlock } from "../components/ThesisBlock";
import { StatStrip } from "../components/StatStrip";
import { PicksSection } from "../components/PicksSection";
import { Footer } from "../components/Footer";
import { ProfileSwitcher } from "../components/ProfileSwitcher";
import { InsightsPanel } from "../components/InsightsPanel";

export const dynamic = "force-dynamic";

export default async function PersonDashboardPage({
  params,
}: {
  params: Promise<{ person: string }>;
}) {
  const { person: slug } = await params;
  const person = await getPersonBySlug(slug);
  if (!person) notFound();

  const picks = await getEnrichedPicks(slug);
  const themes = await getThemes(slug);
  const themeStats = getThemeStats(themes, picks);
  const headline = getHeadlineStats(picks);
  const meta = await getSiteMeta(slug);
  const people = await getPeople();

  const todayRibbon = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="relative flex min-h-[100dvh] w-full max-w-[100vw] flex-col overflow-x-hidden">
      <div className="noise-overlay" aria-hidden="true" />
      <div className="bg-grid relative z-[1] flex min-h-[100dvh] w-full flex-1 flex-col">
        <div className="flex w-full flex-1 flex-col px-3 pb-12 pt-6 sm:px-4 lg:px-6 lg:pb-16 lg:pt-8">
          <div className="animate-fade-up w-full shrink-0">
            <ProfileSwitcher
              current={person}
              people={people}
              todayRibbon={todayRibbon}
            />
          </div>

          <div className="mt-6 flex w-full min-h-0 flex-1 flex-col gap-8 lg:mt-8 lg:gap-10">
            <div className="w-full shrink-0 space-y-8 lg:space-y-10">
              <div className="animate-fade-up w-full [animation-delay:60ms]">
                <Hero meta={meta} person={person} />
              </div>
              <div className="animate-fade-up w-full [animation-delay:100ms]">
                <ThesisBlock meta={meta} />
              </div>
              <div className="animate-fade-up w-full [animation-delay:130ms]">
                <StatStrip stats={headline} />
              </div>
              <div
                id="insights"
                className="animate-fade-up w-full max-w-none [animation-delay:160ms]"
              >
                <InsightsPanel themeStats={themeStats} picks={picks} />
              </div>
            </div>

            <div className="flex min-h-0 w-full flex-1 flex-col [animation-delay:190ms]">
              <Suspense fallback={null}>
                <PicksSection picks={picks} themes={themes} />
              </Suspense>
            </div>

            <div className="animate-fade-up mt-8 w-full shrink-0 [animation-delay:210ms]">
              <Footer meta={meta} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
