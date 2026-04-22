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
import { HighlightsPanel } from "../components/HighlightsPanel";
import { InsightsPanel } from "../components/InsightsPanel";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const people = await getPeople();
  return people.map((p) => ({ person: p.slug }));
}

export default async function PersonDashboardPage({
  params,
}: {
  params: Promise<{ person: string }>;
}) {
  const { person: slug } = await params;
  const person = await getPersonBySlug(slug);
  if (!person) notFound();

  const [picks, themes, meta, people] = await Promise.all([
    getEnrichedPicks(slug),
    getThemes(slug),
    getSiteMeta(slug),
    getPeople(),
  ]);
  const themeStats = getThemeStats(themes, picks);
  const headline = getHeadlineStats(picks);

  return (
    <main className="bg-grid relative min-h-dvh">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <ProfileSwitcher current={person} people={people} />
        <div className="mt-6">
          <Hero meta={meta} person={person} />
        </div>
        <div className="mt-10">
          <ThesisBlock meta={meta} />
        </div>
        <div className="mt-10">
          <StatStrip stats={headline} />
        </div>
        <div className="mt-8">
          <HighlightsPanel
            picks={picks}
            themeMap={new Map(themes.map((theme) => [theme.slug, theme] as const))}
          />
        </div>
        <div id="insights" className="mt-8">
          <InsightsPanel themeStats={themeStats} picks={picks} />
        </div>
        <div className="mt-10">
          <Suspense fallback={null}>
            <PicksSection picks={picks} themes={themes} />
          </Suspense>
        </div>
        <Footer meta={meta} />
      </div>
    </main>
  );
}
