import { getPeople } from "@/lib/data";
import { PersonPicker } from "./components/PersonPicker";

export const dynamic = "force-static";

export default function HomePage() {
  const people = getPeople();

  return (
    <main className="bg-grid relative min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-16 pt-16 sm:px-6 lg:px-10">
        <header className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold-dim)]">
            / Dashboard
          </p>
          <h1 className="mt-3 font-mono text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Choose a <span className="text-[var(--color-gold)]">profile</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--color-text-dim)] sm:text-base">
            Pick a tracker to open its live dashboard. Your last selection is
            remembered for next time.
          </p>
        </header>

        <div className="mt-12 flex-1">
          <PersonPicker people={people} />
        </div>

        <footer className="mt-16 border-t border-[var(--color-border)] pt-6">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
            Not investment advice · Data may be stale
          </p>
        </footer>
      </div>
    </main>
  );
}
