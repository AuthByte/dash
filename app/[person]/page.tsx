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
import { ThemeGrid } from "../components/ThemeGrid";
import { PicksSection } from "../components/PicksSection";
import { Footer } from "../components/Footer";
import { ProfileSwitcher } from "../components/ProfileSwitcher";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getPeople().then((people) => people.map((p) => ({ person: p.slug })));
}

export default async function PersonDashboardPage({
  params,
}: {
  params: Promise<{ person: string }>;
}) {
  const { person: slug } = await params;
  const person = await getPersonBySlug(slug);
  if (!person) notFound();

  const picks = await getEnrichedPicks(slug, { includeHistory: false });
  const themes = await getThemes(slug);
  const themeStats = await getThemeStats(slug, picks);
  const headline = getHeadlineStats(picks);
  const meta = await getSiteMeta(slug);
  const people = await getPeople();

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
          <ThemeGrid stats={themeStats} />
        </div>
        <div className="mt-10">
          <Suspense fallback={null}>
            <PicksSection personSlug={slug} picks={picks} themes={themes} />
          </Suspense>
        </div>
        <Footer meta={meta} />
      </div>
    </main>
  );
}
