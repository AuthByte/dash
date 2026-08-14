import { getPeople } from "@/lib/data";
import { PersonPicker } from "./components/PersonPicker";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const people = await getPeople();

  return (
    <main className="relative min-h-[100dvh]">
      <div className="noise-overlay" aria-hidden="true" />
      <div className="bg-grid relative z-[1] min-h-[100dvh]">
        <div className="mx-auto w-full max-w-none px-3 pb-20 pt-14 sm:px-5 lg:px-8 lg:pb-28 lg:pt-20">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,38%)_minmax(0,1fr)] lg:items-start lg:gap-20">
            <header className="animate-fade-up max-w-xl lg:sticky lg:top-20 lg:pt-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-px w-12 shrink-0 bg-[var(--color-gold)] animate-pulse-line"
                  aria-hidden="true"
                />
                <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--color-gold-dim)]">
                  Roster
                </p>
              </div>
              <h1 className="mt-6 text-left text-4xl font-semibold leading-[0.95] tracking-tighter text-white md:text-5xl lg:text-6xl">
                Pick a
                <span className="block text-[var(--color-gold)]">signal desk.</span>
              </h1>
              <p className="mt-6 text-base leading-relaxed text-[var(--color-text-dim)] md:text-lg">
                Each profile is a live board: themes, conviction, tape, and the
                current thesis—loaded on demand from your data plane.
              </p>
              <div className="mt-10 hidden border-t border-[var(--color-border)] pt-8 lg:block">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                  Index
                </p>
                <ol className="mt-4 space-y-3 font-mono text-xs text-[var(--color-text-dim)]">
                  {people.map((p, i) => (
                    <li
                      key={p.slug}
                      className="flex gap-3 transition-colors hover:text-[var(--color-text)]"
                    >
                      <span className="w-5 shrink-0 text-[var(--color-text-muted)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </header>

            <div className="animate-fade-up min-w-0 [animation-delay:90ms]">
              <PersonPicker people={people} />
            </div>
          </div>

          <footer className="animate-fade-up mt-24 border-t border-[var(--color-border)] pt-8 [animation-delay:140ms]">
            <p className="max-w-prose font-mono text-[10px] uppercase leading-relaxed tracking-[0.26em] text-[var(--color-text-muted)]">
              Not investment advice. Numbers are illustrative of the model in the
              repo, not a solicitation.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
